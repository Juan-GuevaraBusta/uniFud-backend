import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCard } from './entities/user-card.entity';
import { CreateUserCardDto } from './dto/create-user-card.dto';
import { UserCardResponseDto } from './dto/user-card-response.dto';
import { WompiClient } from './providers/wompi.client';
import { UsersService } from '../users/users.service';

@Injectable()
export class UserCardsService {
  private readonly logger = new Logger(UserCardsService.name);

  constructor(
    @InjectRepository(UserCard)
    private readonly userCardsRepository: Repository<UserCard>,
    private readonly wompiClient: WompiClient,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Crear nueva tarjeta para un usuario
   * El token viene del frontend donde se tokenizó la tarjeta con Wompi.js
   */
  async createCard(userId: string, createCardDto: CreateUserCardDto): Promise<UserCardResponseDto> {
    this.logger.log(`Creando tarjeta para usuario ${userId}`);

    // 1. Obtener email del usuario
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Crear Payment Source en Wompi
    let paymentSource;
    try {
      paymentSource = await this.wompiClient.createPaymentSource(
        createCardDto.token,
        createCardDto.acceptanceToken,
        createCardDto.acceptPersonalAuth,
        user.email,
      );
      this.logger.log(`✅ Payment Source creado: ${paymentSource.id}`);
    } catch (error: any) {
      this.logger.error(`❌ Error creando Payment Source: ${error.message}`);
      throw new BadRequestException('Error al guardar tarjeta. Por favor, verifica los datos de tu tarjeta.');
    }

    // 3. Verificar que el Payment Source fue creado exitosamente
    if (!paymentSource.id || paymentSource.status !== 'AVAILABLE') {
      throw new BadRequestException('No se pudo crear la tarjeta. Por favor, intenta nuevamente.');
    }

    // 4. Extraer metadata de la tarjeta
    const publicData = paymentSource.public_data || {};
    const cardLastFour = publicData.last_four || '';
    const cardBrand = this.mapCardBrand(publicData.bin) || 'UNKNOWN';
    const expMonth = parseInt(publicData.exp_month || '0', 10);
    const expYear = parseInt(publicData.exp_year || '0', 10);
    const cardHolderName = publicData.card_holder || publicData.name || '';

    // 5. Verificar si es la primera tarjeta del usuario
    const existingCards = await this.userCardsRepository.count({
      where: { userId, isActive: true },
    });

    // 6. Si es la primera tarjeta, marcarla como default automáticamente
    const isDefault = existingCards === 0 || createCardDto.isDefault === true;

    // 7. Si se marca como default, desmarcar otras tarjetas
    if (isDefault) {
      await this.userCardsRepository.update(
        { userId, isDefault: true, isActive: true },
        { isDefault: false },
      );
    }

    // 8. Crear y guardar la tarjeta
    const card = this.userCardsRepository.create({
      userId,
      wompiPaymentSourceId: paymentSource.id,
      cardLastFour,
      cardBrand,
      cardHolderName,
      expMonth,
      expYear,
      isDefault,
      isActive: true,
    });

    const savedCard = await this.userCardsRepository.save(card);
    this.logger.log(`✅ Tarjeta guardada exitosamente: ${savedCard.id}`);

    return this.toResponseDto(savedCard);
  }

  /**
   * Listar todas las tarjetas activas de un usuario
   */
  async getUserCards(userId: string): Promise<UserCardResponseDto[]> {
    const cards = await this.userCardsRepository.find({
      where: { userId, isActive: true },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return cards.map(card => this.toResponseDto(card));
  }

  /**
   * Obtener una tarjeta específica (con validación de ownership)
   */
  async getCardById(cardId: string, userId: string): Promise<UserCardResponseDto> {
    const card = await this.userCardsRepository.findOne({
      where: { id: cardId, userId, isActive: true },
    });

    if (!card) {
      throw new NotFoundException('Tarjeta no encontrada');
    }

    return this.toResponseDto(card);
  }

  /**
   * Marcar una tarjeta como default
   */
  async setDefaultCard(cardId: string, userId: string): Promise<UserCardResponseDto> {
    // Verificar que la tarjeta existe y pertenece al usuario
    const card = await this.userCardsRepository.findOne({
      where: { id: cardId, userId, isActive: true },
    });

    if (!card) {
      throw new NotFoundException('Tarjeta no encontrada');
    }

    // Desmarcar tarjeta default anterior
    await this.userCardsRepository.update(
      { userId, isDefault: true, isActive: true },
      { isDefault: false },
    );

    // Marcar nueva tarjeta como default
    card.isDefault = true;
    const updatedCard = await this.userCardsRepository.save(card);

    return this.toResponseDto(updatedCard);
  }

  /**
   * Eliminar una tarjeta (soft delete)
   * Nota: No eliminamos el Payment Source en Wompi, solo lo desactivamos localmente
   */
  async deleteCard(cardId: string, userId: string): Promise<void> {
    const card = await this.userCardsRepository.findOne({
      where: { id: cardId, userId, isActive: true },
    });

    if (!card) {
      throw new NotFoundException('Tarjeta no encontrada');
    }

    // Validar que no sea la única tarjeta si es default
    if (card.isDefault) {
      const otherCards = await this.userCardsRepository
        .createQueryBuilder('card')
        .where('card.userId = :userId', { userId })
        .andWhere('card.isActive = :isActive', { isActive: true })
        .andWhere('card.id != :cardId', { cardId })
        .getCount();

      if (otherCards === 0) {
        throw new BadRequestException('No puedes eliminar tu única tarjeta');
      }

      // Si hay otras tarjetas, marcar la primera como default
      const firstOtherCard = await this.userCardsRepository
        .createQueryBuilder('card')
        .where('card.userId = :userId', { userId })
        .andWhere('card.isActive = :isActive', { isActive: true })
        .andWhere('card.id != :cardId', { cardId })
        .orderBy('card.createdAt', 'ASC')
        .getOne();

      if (firstOtherCard) {
        firstOtherCard.isDefault = true;
        await this.userCardsRepository.save(firstOtherCard);
      }
    }

    // Soft delete
    card.isActive = false;
    await this.userCardsRepository.save(card);
  }

  /**
   * Obtener la tarjeta default de un usuario
   */
  async getDefaultCard(userId: string): Promise<UserCard | null> {
    return this.userCardsRepository.findOne({
      where: { userId, isDefault: true, isActive: true },
    });
  }

  /**
   * Convertir entidad a DTO de respuesta
   */
  private toResponseDto(card: UserCard): UserCardResponseDto {
    return {
      id: card.id,
      userId: card.userId,
      wompiPaymentSourceId: card.wompiPaymentSourceId,
      cardLastFour: card.cardLastFour,
      cardBrand: card.cardBrand,
      cardHolderName: card.cardHolderName,
      expMonth: card.expMonth,
      expYear: card.expYear,
      isDefault: card.isDefault,
      isActive: card.isActive,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }

  /**
   * Mapear BIN de tarjeta a marca
   * Los primeros dígitos del BIN indican la marca
   */
  private mapCardBrand(bin?: string): string {
    if (!bin) return 'UNKNOWN';
    
    const firstDigit = bin.charAt(0);
    const firstTwoDigits = bin.substring(0, 2);

    // Visa: empieza con 4
    if (firstDigit === '4') {
      return 'VISA';
    }

    // Mastercard: 51-55 o 2221-2720
    if (firstTwoDigits >= '51' && firstTwoDigits <= '55') {
      return 'MASTERCARD';
    }
    if (bin >= '2221' && bin <= '2720') {
      return 'MASTERCARD';
    }

    // American Express: 34 o 37
    if (firstTwoDigits === '34' || firstTwoDigits === '37') {
      return 'AMEX';
    }

    return 'UNKNOWN';
  }
}

