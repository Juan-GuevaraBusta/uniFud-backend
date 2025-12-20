import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { University } from './entities/university.entity';
import { CreateUniversityDto } from './dto/create-university.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';

@Injectable()
export class UniversitiesService {
  constructor(
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Crear una nueva universidad
   */
  async create(createUniversityDto: CreateUniversityDto): Promise<University> {
    // Verificar si ya existe una universidad con el mismo nombre en la misma ciudad
    const existingUniversity = await this.universityRepository.findOne({
      where: {
        nombre: createUniversityDto.nombre,
        ciudad: createUniversityDto.ciudad,
      },
    });

    if (existingUniversity) {
      throw new ConflictException(
        `Ya existe una universidad con el nombre "${createUniversityDto.nombre}" en ${createUniversityDto.ciudad}`
      );
    }

    // Crear la instancia
    const university = this.universityRepository.create(createUniversityDto);

    // Guardar en la base de datos
    const savedUniversity = await this.universityRepository.save(university);

    // Invalidar caché después de crear
    await this.cacheManager.del('universities:all').catch(() => {
      // Si falla la invalidación, no bloquea la operación
    });

    return savedUniversity;
  }

  /**
   * Obtener todas las universidades
   */
  async findAll(): Promise<University[]> {
    return await this.universityRepository.find({
      order: {
        nombre: 'ASC',
      },
    });
  }

  /**
   * Obtener universidades por ciudad
   */
  async findByCity(ciudad: string): Promise<University[]> {
    return await this.universityRepository.find({
      where: { ciudad },
      order: {
        nombre: 'ASC',
      },
    });
  }

  /**
   * Obtener una universidad por ID
   */
  async findOne(id: string): Promise<University> {
    const university = await this.universityRepository.findOne({
      where: { id },
    });

    if (!university) {
      throw new NotFoundException(`Universidad con ID ${id} no encontrada`);
    }

    return university;
  }

  /**
   * Actualizar una universidad
   */
  async update(id: string, updateUniversityDto: UpdateUniversityDto): Promise<University> {
    // Verificar que existe
    const university = await this.findOne(id);

    // Si se está actualizando nombre o ciudad, verificar unicidad
    if (updateUniversityDto.nombre || updateUniversityDto.ciudad) {
      const nombre = updateUniversityDto.nombre || university.nombre;
      const ciudad = updateUniversityDto.ciudad || university.ciudad;

      const existingUniversity = await this.universityRepository.findOne({
        where: { nombre, ciudad },
      });

      if (existingUniversity && existingUniversity.id !== id) {
        throw new ConflictException(
          `Ya existe una universidad con el nombre "${nombre}" en ${ciudad}`
        );
      }
    }

    // Aplicar cambios
    Object.assign(university, updateUniversityDto);

    // Guardar
    const updatedUniversity = await this.universityRepository.save(university);

    // Invalidar caché después de actualizar
    await this.cacheManager.del('universities:all').catch(() => {
      // Si falla la invalidación, no bloquea la operación
    });

    return updatedUniversity;
  }

  /**
   * Eliminar una universidad
   */
  async remove(id: string): Promise<void> {
    const university = await this.findOne(id);
    await this.universityRepository.remove(university);

    // Invalidar caché después de eliminar
    await this.cacheManager.del('universities:all').catch(() => {
      // Si falla la invalidación, no bloquea la operación
    });
  }
}