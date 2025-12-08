import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { UniversitiesService } from './universities.service';
import { CreateUniversityDto } from './dto/create-university.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
import { UniversityResponseDto } from './dto/university-response.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Universidades')
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  /**
   * Crear una nueva universidad
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear universidad',
    description: 'Crea una nueva universidad en el sistema',
  })
  @ApiResponse({
    status: 201,
    description: 'Universidad creada exitosamente',
    type: UniversityResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una universidad con ese nombre en esa ciudad',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async create(@Body() createUniversityDto: CreateUniversityDto) {
    return await this.universitiesService.create(createUniversityDto);
  }

  /**
   * Obtener todas las universidades
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar universidades',
    description: 'Obtiene todas las universidades registradas',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de universidades',
    type: [UniversityResponseDto],
  })
  @ApiQuery({
    name: 'ciudad',
    required: false,
    description: 'Filtrar por ciudad',
    example: 'Bogotá',
  })
  async findAll(@Query('ciudad') ciudad?: string) {
    if (ciudad) {
      return await this.universitiesService.findByCity(ciudad);
    }
    return await this.universitiesService.findAll();
  }

  /**
   * Obtener una universidad por ID
   */
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener universidad',
    description: 'Obtiene los detalles de una universidad por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la universidad',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Universidad encontrada',
    type: UniversityResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Universidad no encontrada',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async findOne(@Param('id') id: string) {
    return await this.universitiesService.findOne(id);
  }

  /**
   * Actualizar una universidad
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar universidad',
    description: 'Actualiza los datos de una universidad existente',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la universidad',
  })
  @ApiResponse({
    status: 200,
    description: 'Universidad actualizada exitosamente',
    type: UniversityResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Universidad no encontrada',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto con nombre/ciudad',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateUniversityDto: UpdateUniversityDto,
  ) {
    return await this.universitiesService.update(id, updateUniversityDto);
  }

  /**
   * Eliminar una universidad
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar universidad',
    description: 'Elimina una universidad del sistema',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la universidad',
  })
  @ApiResponse({
    status: 204,
    description: 'Universidad eliminada exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Universidad no encontrada',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async remove(@Param('id') id: string) {
    await this.universitiesService.remove(id);
  }
}