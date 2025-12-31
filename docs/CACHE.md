# Configuración de Caché con Redis - UniFoodApp

## Visión General

El sistema de caché está configurado para usar Redis en producción y memoria en desarrollo (si Redis no está disponible). Esto mejora significativamente el rendimiento al reducir la carga en la base de datos.

## Configuración

### Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Redis Cache (Opcional)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Opcional, solo si Redis tiene contraseña
CACHE_TTL=300    # Tiempo de vida en segundos (5 minutos por defecto)
CACHE_MAX_ITEMS=1000  # Máximo de items en caché
```

### Desarrollo Local

#### Opción 1: Usar Docker Compose (Recomendado)

```bash
# Iniciar Redis
docker-compose up -d redis

# Verificar que está corriendo
docker ps
```

Redis estará disponible en `localhost:6379`

#### Opción 2: Instalar Redis Localmente

**macOS**:
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows**:
Descarga e instala desde: https://redis.io/download

#### Opción 3: Usar Caché en Memoria (Sin Redis)

Si no configuras `REDIS_HOST` en desarrollo, el sistema usará automáticamente caché en memoria. Esto es útil para desarrollo local sin necesidad de Redis.

### Producción

En producción, asegúrate de tener Redis configurado:

1. **Servicio gestionado** (Recomendado):
   - AWS ElastiCache
   - Redis Cloud
   - DigitalOcean Managed Redis
   - Railway Redis

2. **Servidor propio**:
   - Instala Redis en tu servidor
   - Configura contraseña y seguridad
   - Configura variables de entorno

## Uso en Servicios

### Inyectar Cache Manager

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MyService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getData(key: string) {
    // Intentar obtener de caché
    const cached = await this.cacheManager.get(key);
    if (cached) {
      return cached;
    }

    // Si no está en caché, obtener de la fuente
    const data = await this.fetchFromDatabase();

    // Guardar en caché con TTL personalizado
    await this.cacheManager.set(key, data, { ttl: 3600 }); // 1 hora

    return data;
  }

  async invalidateCache(key: string) {
    await this.cacheManager.del(key);
  }

  async clearAllCache() {
    await this.cacheManager.reset();
  }
}
```

### Usar Decorador @CacheKey y @CacheTTL

```typescript
import { Controller, Get, CacheKey, CacheTTL } from '@nestjs/common';
import { UseInterceptors, CacheInterceptor } from '@nestjs/cache-manager';

@Controller('universities')
@UseInterceptors(CacheInterceptor)
export class UniversitiesController {
  @Get()
  @CacheKey('universities:all')
  @CacheTTL(3600) // 1 hora
  async findAll() {
    return this.universitiesService.findAll();
  }
}
```

## Estrategias de Caché

### Universities

- **findAll()**: Cachear por 1 hora
- Invalidar al crear/actualizar/eliminar

### Restaurants

- **findByUniversity()**: Cachear por 15 minutos
- Invalidar al cambiar disponibilidad o menú

### Dishes

- **Menú completo**: Cachear por 10 minutos
- Invalidar al actualizar disponibilidad

## Invalidación de Caché

Es importante invalidar el caché cuando los datos cambian:

```typescript
// Después de crear/actualizar/eliminar
await this.cacheManager.del('universities:all');
await this.cacheManager.del(`restaurants:university:${universityId}`);
await this.cacheManager.del(`dishes:restaurant:${restaurantId}:menu`);
```

## Monitoreo

### Verificar Estado de Redis

```bash
# Conectar a Redis CLI
redis-cli

# Verificar conexión
ping

# Ver todas las claves
keys *

# Ver información del servidor
info

# Ver memoria usada
info memory
```

### Logs

El sistema registra automáticamente:
- Conexiones a Redis
- Errores de caché
- Fallbacks a memoria

## Troubleshooting

### Redis no se conecta

1. Verifica que Redis esté corriendo:
   ```bash
   docker ps  # Si usas Docker
   redis-cli ping  # Si está instalado localmente
   ```

2. Verifica las variables de entorno:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD` (si aplica)

3. Verifica la conectividad:
   ```bash
   telnet localhost 6379
   ```

### Caché no funciona

1. Verifica que `CacheModule` esté importado en `app.module.ts`
2. Verifica que el servicio inyecte `CACHE_MANAGER`
3. Revisa los logs del servidor para errores

### Fallback a Memoria

Si Redis no está disponible, el sistema automáticamente usa caché en memoria. Esto es útil para desarrollo pero no recomendado para producción.

## Mejores Prácticas

1. **TTL apropiado**: No caches datos que cambian frecuentemente por mucho tiempo
2. **Invalidación**: Siempre invalida el caché cuando actualizas datos
3. **Claves descriptivas**: Usa prefijos claros (ej: `universities:all`, `restaurants:university:123`)
4. **Monitoreo**: Revisa el uso de memoria de Redis regularmente
5. **Producción**: Usa Redis gestionado o configurado con seguridad

## Referencias

- [NestJS Cache Manager](https://docs.nestjs.com/techniques/caching)
- [Redis Documentation](https://redis.io/documentation)
- [cache-manager-redis-store](https://github.com/dabroek/node-cache-manager-redis-store)

---

**Última actualización**: Día 14 - Implementación de caché con Redis
**Estado**: Configuración completa y lista para usar ✅


