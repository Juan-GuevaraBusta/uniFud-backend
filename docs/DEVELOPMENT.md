# Guía de Desarrollo - UniFoodApp Backend

## Tabla de Contenidos

1. [Requisitos](#requisitos)
2. [Setup del Entorno](#setup-del-entorno)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Scripts Disponibles](#scripts-disponibles)
5. [Base de Datos](#base-de-datos)
6. [Variables de Entorno](#variables-de-entorno)
7. [Debugging](#debugging)
8. [Testing](#testing)
9. [Convenciones de Código](#convenciones-de-código)
10. [Troubleshooting](#troubleshooting)

---

## Requisitos

### Software Necesario

- **Node.js**: >= 18.x
- **npm**: >= 9.x (o yarn/pnpm)
- **PostgreSQL**: >= 15.x
- **Git**: Para control de versiones

### Verificar Versiones

```bash
node --version  # Debe ser >= 18.0.0
npm --version   # Debe ser >= 9.0.0
psql --version  # Debe ser >= 15.0.0
```

---

## Setup del Entorno

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Juan-GuevaraBusta/uniFud-backend.git
cd uni-fud-backend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Base de Datos

#### Crear Base de Datos PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE unifood_db;

# Crear usuario (opcional)
CREATE USER unifood_admin WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE unifood_db TO unifood_admin;
```

### 4. Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=unifood_admin
DB_PASSWORD=tu_password_seguro
DB_NAME=unifood_db

# JWT
JWT_SECRET=tu-secreto-super-seguro-cambiar-en-produccion
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=tu-refresh-secreto-cambiar-en-produccion
JWT_REFRESH_EXPIRATION=7d

# CORS (desarrollo)
# Se configuran automáticamente para localhost y Expo
```

**⚠️ Importante**: Nunca commitees el archivo `.env` real. Solo `.env.example` si existe.

### 5. Iniciar el Servidor

```bash
# Modo desarrollo (con hot-reload)
npm run start:dev

# El servidor iniciará en:
# - API: http://localhost:3000
# - Swagger: http://localhost:3000/api/docs
```

---

## Estructura del Proyecto

```
uni-fud-backend/
├── src/
│   ├── auth/              # Módulo de autenticación
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── strategies/    # Passport strategies (JWT, Local)
│   │   └── *.ts
│   ├── users/             # Módulo de usuarios
│   ├── universities/      # Módulo de universidades
│   ├── restaurants/      # Módulo de restaurantes
│   ├── dishes/           # Módulo de platos
│   ├── orders/           # Módulo de pedidos
│   ├── notifications/    # Módulo de notificaciones
│   ├── common/           # Código compartido
│   │   ├── decorators/   # Decoradores personalizados
│   │   ├── guards/       # Guards de seguridad
│   │   ├── interceptors/ # Interceptores globales
│   │   ├── filters/      # Filtros de excepciones
│   │   ├── exceptions/   # Excepciones personalizadas
│   │   └── dto/          # DTOs compartidos
│   ├── config/           # Configuraciones
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   └── cors.config.ts
│   ├── app.module.ts     # Módulo principal
│   └── main.ts           # Punto de entrada
├── test/                 # Tests E2E
├── docs/                 # Documentación
├── dist/                 # Código compilado (generado)
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### Convenciones de Nombres

- **Módulos**: `*.module.ts`
- **Controladores**: `*.controller.ts`
- **Servicios**: `*.service.ts`
- **Entidades**: `*.entity.ts`
- **DTOs**: `*.dto.ts`
- **Guards**: `*.guard.ts`
- **Interceptores**: `*.interceptor.ts`
- **Filtros**: `*.filter.ts`

---

## Scripts Disponibles

### Desarrollo

```bash
# Iniciar en modo desarrollo (con hot-reload)
npm run start:dev

# Iniciar en modo debug
npm run start:debug

# Iniciar en modo producción (requiere build)
npm run start:prod
```

### Build

```bash
# Compilar TypeScript a JavaScript
npm run build

# El código compilado se genera en la carpeta `dist/`
```

### Testing

```bash
# Ejecutar todos los tests
npm run test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con coverage
npm run test:cov

# Ejecutar tests E2E
npm run test:e2e

# Ejecutar tests en modo debug
npm run test:debug
```

### Linting y Formato

```bash
# Ejecutar ESLint
npm run lint

# Formatear código con Prettier
npm run format
```

---

## Base de Datos

### TypeORM Synchronize

En desarrollo, TypeORM puede sincronizar automáticamente el esquema:

```typescript
// config/database.config.ts
synchronize: process.env.NODE_ENV === 'development'
```

**⚠️ Advertencia**: `synchronize: true` solo debe usarse en desarrollo. En producción, usar migraciones.

### Migraciones

#### Crear Migración

```bash
# Instalar TypeORM CLI globalmente (si no está instalado)
npm install -g typeorm

# Crear migración
typeorm migration:create src/migrations/NombreMigracion

# O usando el script de NestJS (si está configurado)
npm run migration:create -- NombreMigracion
```

#### Ejecutar Migraciones

```bash
# Ejecutar migraciones pendientes
npm run migration:run

# Revertir última migración
npm run migration:revert
```

### Conexión Manual a PostgreSQL

```bash
# Conectar desde terminal
psql -U unifood_admin -d unifood_db -h localhost

# Ver tablas
\dt

# Ver estructura de una tabla
\d nombre_tabla

# Salir
\q
```

### Backup y Restore

```bash
# Backup
pg_dump -U unifood_admin -d unifood_db > backup.sql

# Restore
psql -U unifood_admin -d unifood_db < backup.sql
```

---

## Variables de Entorno

### Variables Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `development`, `production` |
| `PORT` | Puerto del servidor | `3000` |
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_USERNAME` | Usuario de PostgreSQL | `unifood_admin` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | `tu_password` |
| `DB_NAME` | Nombre de la base de datos | `unifood_db` |
| `JWT_SECRET` | Secreto para JWT | `secreto-super-seguro` |
| `JWT_EXPIRATION` | Expiración del access token | `1h` |
| `JWT_REFRESH_SECRET` | Secreto para refresh token | `refresh-secreto` |
| `JWT_REFRESH_EXPIRATION` | Expiración del refresh token | `7d` |

### Variables Opcionales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Nivel de logging | `info` |
| `CORS_ORIGIN` | Orígenes permitidos | Configurado automáticamente |

### Validación de Variables

Las variables de entorno se validan al iniciar la aplicación. Si falta alguna requerida, la aplicación no iniciará.

---

## Debugging

### VS Code

Configurar `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

### Chrome DevTools

1. Iniciar con `npm run start:debug`
2. Abrir Chrome y navegar a `chrome://inspect`
3. Click en "Open dedicated DevTools for Node"

### Logs

Los logs se muestran en la consola con el siguiente formato:

```
[HTTP] POST /orders 201 45ms - 127.0.0.1 - User: 123e4567-e89b-12d3-a456-426614174000
```

### Interceptores de Logging

El `LoggingInterceptor` registra automáticamente:
- Método HTTP
- URL
- Código de estado
- Tiempo de respuesta
- IP del cliente
- Usuario autenticado (si aplica)

---

## Testing

### Estructura de Tests

```
src/
├── users/
│   ├── users.service.spec.ts    # Tests unitarios del servicio
│   └── users.controller.spec.ts # Tests del controlador
test/
└── app.e2e-spec.ts              # Tests E2E
```

### Escribir Tests Unitarios

```typescript
// users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Escribir Tests E2E

```typescript
// test/orders.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Orders (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/orders (POST)', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({
        restaurantId: '123',
        items: []
      })
      .expect(201);
  });
});
```

### Coverage

Para ver el coverage de tests:

```bash
npm run test:cov
```

El reporte se genera en `coverage/`.

---

## Convenciones de Código

### TypeScript

- Usar **interfaces** para tipos de datos
- Usar **enums** para valores constantes
- Usar **classes** para entidades y DTOs
- Evitar `any`, usar tipos específicos

### NestJS

- Un módulo por feature
- Inyectar dependencias mediante constructor
- Usar decoradores de NestJS
- Separar lógica de negocio en servicios

### Naming

- **Variables**: `camelCase`
- **Clases**: `PascalCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Archivos**: `kebab-case.ts` o `camelCase.ts`

### Imports

Ordenar imports:
1. Imports de librerías externas
2. Imports de NestJS
3. Imports relativos

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
```

---

## Troubleshooting

### Error: "Cannot find module"

```bash
# Eliminar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Error: "Port 3000 already in use"

```bash
# Encontrar proceso usando el puerto
lsof -i :3000

# Matar el proceso
kill -9 <PID>

# O cambiar el puerto en .env
PORT=3001
```

### Error: "Database connection failed"

1. Verificar que PostgreSQL esté corriendo:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Verificar credenciales en `.env`
3. Verificar que la base de datos exista:
   ```bash
   psql -U postgres -l
   ```

### Error: "JWT secret is not defined"

Agregar `JWT_SECRET` al archivo `.env`.

### Error: "TypeORM entity not found"

1. Verificar que la entidad esté exportada en el módulo
2. Verificar que `entities` esté configurado en `database.config.ts`
3. Reiniciar el servidor

### Hot Reload No Funciona

1. Verificar que estés usando `npm run start:dev`
2. Verificar que no haya errores de compilación
3. Reiniciar el servidor

### Swagger No Se Muestra

1. Verificar que el servidor esté corriendo
2. Acceder a `http://localhost:3000/api/docs`
3. Verificar que no haya errores en la consola

---

## Recursos Adicionales

- [Documentación de NestJS](https://docs.nestjs.com/)
- [Documentación de TypeORM](https://typeorm.io/)
- [Documentación de Swagger](https://swagger.io/docs/)
- [Guía de la API](./API.md)
- [Guía de Despliegue](./DEPLOYMENT.md)

---

**Última actualización**: Enero 2024

