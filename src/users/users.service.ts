import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { isValidRole } from '../common/constants/roles.constant';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Verificar si el email ya existe
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Crear instancia del usuario
    const user = this.userRepository.create(createUserDto);
    
    // Guardar en la base de datos
    return await this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    
    // Merge de los datos actualizados
    Object.assign(user, updateUserDto);
    
    return await this.userRepository.save(user);
  }

  async setVerificationCode(id: string, code: string): Promise<void> {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24); // Expira en 24 horas

    await this.userRepository.update(id, {
      verificationCode: code,
      verificationCodeExpiry: expiryDate,
    });
  }

  async verifyEmail(id: string): Promise<void> {
    await this.userRepository.update(id, {
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<User>> {
    const [items, total] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: pagination ? pagination.skip : undefined,
      take: pagination ? pagination.take : undefined,
    });

    return {
      items,
      meta: {
        total,
        limit: pagination?.limit ?? (total > 0 ? total : 1),
        page: pagination?.page ?? 1,
        totalPages: Math.max(1, Math.ceil(total / (pagination?.limit ?? (total > 0 ? total : 1)))),
      },
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  /**
   * Cambiar el rol de un usuario (solo para administradores)
   * @param userId - ID del usuario a modificar
   * @param updateRoleDto - DTO con el nuevo rol
   * @returns Usuario actualizado
   */
  async updateRole(userId: string, updateRoleDto: UpdateRoleDto): Promise<User> {
    const user = await this.findOne(userId);

    // Validar que el rol sea válido
    if (!isValidRole(updateRoleDto.role)) {
      throw new BadRequestException(`Rol inválido: ${updateRoleDto.role}`);
    }

    // No permitir cambiar el rol si el usuario ya tiene ese rol
    if (user.role === updateRoleDto.role) {
      throw new BadRequestException(`El usuario ya tiene el rol ${updateRoleDto.role}`);
    }

    // Actualizar el rol
    user.role = updateRoleDto.role;

    return await this.userRepository.save(user);
  }
}

