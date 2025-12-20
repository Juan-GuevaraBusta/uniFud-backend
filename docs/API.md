# Documentación de la API - UniFoodApp Backend

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Endpoints por Módulo](#endpoints-por-módulo)
3. [Ejemplos de Uso](#ejemplos-de-uso)
4. [Códigos de Error](#códigos-de-error)
5. [Formato de Respuestas](#formato-de-respuestas)
6. [Paginación](#paginación)
7. [Rate Limiting](#rate-limiting)

---

## Autenticación

### Flujo de Autenticación

La API utiliza **JWT (JSON Web Tokens)** para autenticación. El flujo completo es:

1. **Registro** → `POST /auth/register`
2. **Confirmar Email** → `POST /auth/confirm-email`
3. **Login** → `POST /auth/login` (obtiene tokens)
4. **Usar Token** → Incluir en header `Authorization: Bearer <token>`
5. **Refresh Token** → `POST /auth/refresh` (renovar access token)

### Obtener Tokens

#### 1. Registro de Usuario

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan.perez@universidadean.edu.co",
    "password": "Password123!",
    "nombre": "Juan Pérez",
    "role": "student"
  }'
```

**Respuesta**:
```json
{
  "message": "Usuario registrado exitosamente. Por favor verifica tu email.",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Nota**: El código de verificación se muestra en la consola del servidor (en desarrollo).

#### 2. Confirmar Email

```bash
curl -X POST http://localhost:3000/auth/confirm-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan.perez@universidadean.edu.co",
    "code": "123456"
  }'
```

#### 3. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan.perez@universidadean.edu.co",
    "password": "Password123!"
  }'
```

**Respuesta**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "juan.perez@universidadean.edu.co",
    "nombre": "Juan Pérez",
    "role": "student"
  }
}
```

### Usar Tokens en Requests

Incluir el token en el header `Authorization`:

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Refresh Token

Cuando el access token expire, usar el refresh token para obtener uno nuevo:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## Endpoints por Módulo

### Autenticación (`/auth`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Registrar nuevo usuario | ❌ Público |
| POST | `/auth/login` | Iniciar sesión | ❌ Público |
| POST | `/auth/confirm-email` | Confirmar email | ❌ Público |
| POST | `/auth/resend-code` | Reenviar código de verificación | ❌ Público |
| POST | `/auth/refresh` | Renovar access token | ❌ Público |
| GET | `/auth/profile` | Obtener perfil del usuario | ✅ Requerido |
| POST | `/auth/logout` | Cerrar sesión | ✅ Requerido |

### Usuarios (`/users`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/users` | Crear usuario | ✅ Requerido |
| GET | `/users` | Listar usuarios (paginado) | ✅ Requerido |
| GET | `/users/:id` | Obtener usuario por ID | ✅ Requerido |
| PATCH | `/users/:id` | Actualizar usuario | ✅ Requerido |
| DELETE | `/users/:id` | Eliminar usuario | ✅ Requerido |

### Universidades (`/universities`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/universities` | Crear universidad | ✅ Requerido |
| GET | `/universities` | Listar universidades | ❌ Público |
| GET | `/universities?ciudad=Bogotá` | Filtrar por ciudad | ❌ Público |
| GET | `/universities/:id` | Obtener universidad | ❌ Público |
| PATCH | `/universities/:id` | Actualizar universidad | ✅ Requerido |
| DELETE | `/universities/:id` | Eliminar universidad | ✅ Requerido |

### Restaurantes (`/restaurants`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/restaurants` | Crear restaurante | ✅ Requerido (restaurant_owner) |
| GET | `/restaurants` | Listar restaurantes activos | ❌ Público |
| GET | `/restaurants?universityId=...` | Filtrar por universidad | ❌ Público |
| GET | `/restaurants/me` | Obtener mi restaurante | ✅ Requerido (restaurant_owner) |
| GET | `/restaurants/university/:id` | Restaurantes por universidad | ❌ Público |
| GET | `/restaurants/:id` | Obtener restaurante | ❌ Público |
| PATCH | `/restaurants/:id` | Actualizar restaurante | ✅ Requerido (owner) |
| PATCH | `/restaurants/:id/toggle-active` | Activar/desactivar | ✅ Requerido (owner) |
| DELETE | `/restaurants/:id` | Eliminar restaurante | ✅ Requerido (owner) |

### Platos (`/dishes`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/dishes` | Crear plato | ✅ Requerido (restaurant_owner) |
| GET | `/dishes` | Listar platos (con filtros) | ❌ Público |
| GET | `/dishes/restaurant/:id` | Menú del restaurante | ❌ Público |
| GET | `/dishes/:id` | Obtener plato | ❌ Público |
| PATCH | `/dishes/:id` | Actualizar plato | ✅ Requerido (owner) |
| PATCH | `/dishes/:id/toggle-active` | Activar/desactivar | ✅ Requerido (owner) |
| POST | `/dishes/:id/toppings` | Agregar topping | ✅ Requerido (owner) |
| DELETE | `/dishes/:id/toppings/:toppingId` | Eliminar topping | ✅ Requerido (owner) |
| DELETE | `/dishes/:id` | Eliminar plato | ✅ Requerido (owner) |
| PATCH | `/dishes/:id/availability?restaurantId=...` | Actualizar disponibilidad | ✅ Requerido (owner) |
| GET | `/dishes/availability/restaurant/:id` | Disponibilidad del restaurante | ❌ Público |
| GET | `/dishes/menu/:id` | Menú con disponibilidad | ❌ Público |
| PATCH | `/dishes/availability/restaurant/:id/bulk` | Actualización masiva | ✅ Requerido (owner) |

### Pedidos (`/orders`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/orders` | Crear pedido | ✅ Requerido (student) |
| GET | `/orders` | Listar pedidos (por rol) | ✅ Requerido |
| GET | `/orders/:id` | Detalle de pedido | ✅ Requerido |
| GET | `/orders/restaurant/:id` | Pedidos del restaurante | ✅ Requerido (restaurant_owner) |
| PATCH | `/orders/:id/status` | Actualizar estado | ✅ Requerido (restaurant_owner) |
| PATCH | `/orders/:id/cancel` | Cancelar pedido | ✅ Requerido |

### Notificaciones (`/notifications`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/notifications/register` | Registrar token Expo | ✅ Requerido |
| GET | `/notifications/me` | Mis tokens | ✅ Requerido |
| PATCH | `/notifications/:id` | Actualizar token | ✅ Requerido |
| DELETE | `/notifications/:id` | Desactivar token | ✅ Requerido |
| DELETE | `/notifications` | Desactivar todos los tokens | ✅ Requerido |
| POST | `/notifications/send` | Enviar notificación manual | ✅ Requerido (admin/owner) |

---

## Ejemplos de Uso

### Crear un Pedido Completo

```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "estudiante@universidadean.edu.co",
    "password": "Password123!"
  }' | jq -r '.accessToken')

# 2. Obtener menú del restaurante
curl -X GET http://localhost:3000/dishes/restaurant/RESTAURANT_ID \
  -H "Authorization: Bearer $TOKEN"

# 3. Crear pedido
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "123e4567-e89b-12d3-a456-426614174000",
    "items": [
      {
        "dishId": "dish-uuid-here",
        "dishNombre": "Hamburguesa Clásica",
        "cantidad": 2,
        "precioUnitario": 15000,
        "precioTotal": 30000,
        "toppingsSeleccionados": [
          {
            "toppingId": "topping-uuid",
            "nombre": "Queso Extra",
            "precio": 2000
          }
        ],
        "comentarios": "Sin cebolla"
      }
    ]
  }'
```

### Actualizar Estado de Pedido (Restaurante)

```bash
curl -X PATCH http://localhost:3000/orders/ORDER_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PREPARANDO",
    "tiempoEstimado": 15,
    "comentarios": "En preparación"
  }'
```

### Registrar Token de Notificación

```bash
curl -X POST http://localhost:3000/notifications/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "deviceId": "unique-device-id",
    "platform": "ios",
    "deviceInfo": {
      "model": "iPhone 14",
      "osVersion": "16.0"
    },
    "configuraciones": {
      "pedidosNuevos": true,
      "cambiosEstado": true,
      "promociones": false
    }
  }'
```

---

## Códigos de Error

### Códigos HTTP Comunes

| Código | Significado | Descripción |
|--------|------------|-------------|
| 200 | OK | Request exitoso |
| 201 | Created | Recurso creado exitosamente |
| 204 | No Content | Operación exitosa sin contenido |
| 400 | Bad Request | Datos inválidos o validación fallida |
| 401 | Unauthorized | No autenticado o token inválido |
| 403 | Forbidden | No autorizado para esta acción |
| 404 | Not Found | Recurso no encontrado |
| 409 | Conflict | Conflicto (ej: email duplicado) |
| 422 | Unprocessable Entity | Error de validación de negocio |
| 500 | Internal Server Error | Error interno del servidor |

### Formato de Errores

Todos los errores siguen este formato:

```json
{
  "success": false,
  "message": "Descripción legible del error",
  "statusCode": 400,
  "errorCode": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/orders"
}
```

### Códigos de Error Específicos

#### Autenticación

- `AUTH_INVALID_CREDENTIALS`: Credenciales inválidas
- `AUTH_EMAIL_NOT_VERIFIED`: Email no verificado
- `AUTH_TOKEN_EXPIRED`: Token expirado
- `AUTH_TOKEN_INVALID`: Token inválido

#### Pedidos

- `ORDER_NOT_FOUND`: Pedido no encontrado
- `ORDER_INVALID_STATUS`: Transición de estado inválida
- `ORDER_CANNOT_CANCEL`: No se puede cancelar en este estado
- `ORDER_DISH_NOT_AVAILABLE`: Plato no disponible
- `ORDER_DUPLICATE_PENDING`: Ya existe un pedido pendiente

#### Platos

- `DISH_NOT_FOUND`: Plato no encontrado
- `DISH_INVALID_TOPPING`: Topping no válido para este tipo de plato
- `DISH_NOT_OWNED`: No eres dueño de este plato

#### Restaurantes

- `RESTAURANT_NOT_FOUND`: Restaurante no encontrado
- `RESTAURANT_ALREADY_EXISTS`: Ya tienes un restaurante
- `RESTAURANT_NAME_DUPLICATE`: Nombre duplicado en la universidad
- `RESTAURANT_NOT_OWNED`: No eres dueño de este restaurante

---

## Formato de Respuestas

### Respuestas Exitosas

Todas las respuestas exitosas pasan por el `TransformInterceptor`:

```json
{
  "success": true,
  "data": {
    // Datos del recurso
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Ejemplo**:
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "numeroOrden": "#001-2024",
    "status": "PENDIENTE",
    "total": 15750
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Respuestas de Error

Todas las respuestas de error pasan por el `AllExceptionsFilter`:

```json
{
  "success": false,
  "message": "Descripción del error",
  "statusCode": 400,
  "errorCode": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/orders"
}
```

---

## Paginación

Los endpoints de listado soportan paginación mediante query parameters:

### Parámetros

- `page`: Número de página (por defecto: 1)
- `limit`: Elementos por página (por defecto: 20, máximo: 100)

### Ejemplo

```bash
curl -X GET "http://localhost:3000/orders?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Respuesta Paginada

```json
{
  "success": true,
  "data": {
    "items": [
      // Array de recursos
    ],
    "meta": {
      "total": 100,
      "limit": 20,
      "page": 1,
      "totalPages": 5
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Endpoints con Paginación

- `GET /users` - Listar usuarios
- `GET /orders` - Listar pedidos
- `GET /dishes` - Listar platos
- `GET /orders/restaurant/:id` - Pedidos del restaurante

---

## Rate Limiting

La API implementa rate limiting para prevenir abuso:

- **TTL**: 5 segundos
- **Límite**: 15 requests por ventana de tiempo
- **Aplicado a**: Todos los endpoints

### Respuesta cuando se excede el límite

```json
{
  "success": false,
  "message": "Too Many Requests",
  "statusCode": 429,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Notas Adicionales

### Headers Requeridos

- `Content-Type: application/json` (para POST/PATCH)
- `Authorization: Bearer <token>` (para endpoints protegidos)

### Timeouts

- **Request timeout**: 30 segundos
- **JWT expiration**: 1 hora (configurable)
- **Refresh token expiration**: 7 días (configurable)

### CORS

En desarrollo, se permiten requests desde:
- `http://localhost:19006` (Expo)
- `http://localhost:3000`
- `exp://*` (URLs de Expo)
- IPs locales (192.168.x.x)

En producción, configurar `CORS_ORIGIN` en variables de entorno.

---

## Documentación Interactiva

Para documentación interactiva y pruebas en tiempo real, visita:

**Swagger UI**: http://localhost:3000/api/docs

Aquí puedes:
- Ver todos los endpoints organizados
- Probar endpoints directamente
- Ver ejemplos de requests/responses
- Autenticarte con el botón "Authorize"

---

**Última actualización**: Enero 2024  
**Versión de la API**: 1.0.0


