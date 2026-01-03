import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserCardsService } from './user-cards.service';
import { CreateUserCardDto } from './dto/create-user-card.dto';
import { UserCardResponseDto } from './dto/user-card-response.dto';

@ApiTags('Tarjetas de Usuario')
@Controller('payments/cards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserCardsController {
  constructor(private readonly userCardsService: UserCardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar una nueva tarjeta' })
  @ApiResponse({
    status: 201,
    description: 'Tarjeta agregada exitosamente',
    type: UserCardResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error al crear tarjeta' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async createCard(
    @CurrentUser() user: any,
    @Body() createCardDto: CreateUserCardDto,
  ): Promise<UserCardResponseDto> {
    return this.userCardsService.createCard(user.id, createCardDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas mis tarjetas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tarjetas del usuario',
    type: [UserCardResponseDto],
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMyCards(@CurrentUser() user: any): Promise<UserCardResponseDto[]> {
    return this.userCardsService.getUserCards(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una tarjeta específica' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta' })
  @ApiResponse({
    status: 200,
    description: 'Tarjeta encontrada',
    type: UserCardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getCard(@CurrentUser() user: any, @Param('id') cardId: string): Promise<UserCardResponseDto> {
    return this.userCardsService.getCardById(cardId, user.id);
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una tarjeta como default' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta' })
  @ApiResponse({
    status: 200,
    description: 'Tarjeta marcada como default',
    type: UserCardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async setDefaultCard(
    @CurrentUser() user: any,
    @Param('id') cardId: string,
  ): Promise<UserCardResponseDto> {
    return this.userCardsService.setDefaultCard(cardId, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una tarjeta' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta' })
  @ApiResponse({ status: 204, description: 'Tarjeta eliminada exitosamente' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar la única tarjeta' })
  @ApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async deleteCard(@CurrentUser() user: any, @Param('id') cardId: string): Promise<void> {
    return this.userCardsService.deleteCard(cardId, user.id);
  }
}

