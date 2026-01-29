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

### Pagos (`/payments`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/payments/cards` | Agregar nueva tarjeta | ✅ Requerido |
| GET | `/payments/cards` | Listar mis tarjetas | ✅ Requerido |
| GET | `/payments/cards/:id` | Obtener tarjeta específica | ✅ Requerido |
| PATCH | `/payments/cards/:id/default` | Marcar tarjeta como default | ✅ Requerido |
| DELETE | `/payments/cards/:id` | Eliminar tarjeta | ✅ Requerido |
| POST | `/payments/webhooks` | Webhook de Wompi | ❌ No requerido (firma requerida) |

### Facturas (`/invoices`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| GET | `/invoices/:id` | Obtener factura por ID | ✅ Requerido |
| GET | `/invoices/order/:orderId` | Obtener factura por número de pedido | ✅ Requerido |

---

## Integración con Siigo - Facturación Electrónica

### Introducción

UniFoodApp utiliza **Siigo** para generar facturas electrónicas automáticamente cuando un pedido se completa exitosamente. Siigo es una plataforma de contabilidad en la nube que permite la emisión de facturas electrónicas válidas en Colombia.

**Flujo automático de facturación:**
1. Usuario crea pedido y pago es aprobado
2. Pedido se guarda en la base de datos
3. Sistema intenta crear factura en Siigo automáticamente (no bloquea el pedido si falla)
4. Factura se guarda en BD local con referencia a Siigo
5. Usuario puede consultar su factura en cualquier momento

### Endpoints de Facturación

#### Obtener Factura por ID

```bash
curl -X GET http://localhost:3000/invoices/INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "orderId": "order-uuid",
    "siigoInvoiceId": "siigo-invoice-id",
    "invoiceNumber": "FE-001234",
    "invoicePrefix": "FE",
    "customerName": "Juan Pérez",
    "customerDocument": "1234567890",
    "customerDocumentType": "CC",
    "customerEmail": "juan.perez@universidadean.edu.co",
    "subtotal": 10000.00,
    "tax": 1900.00,
    "total": 11900.00,
    "paymentMethod": "card",
    "items": [
      {
        "description": "Pizza Margarita",
        "quantity": 2,
        "unitPrice": 5000.00,
        "tax": 1900.00,
        "total": 11900.00
      }
    ],
    "pdfUrl": "https://api.siigo.com/invoices/siigo-invoice-id/pdf",
    "xmlUrl": "https://api.siigo.com/invoices/siigo-invoice-id/xml",
    "status": "sent",
    "sentAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Obtener Factura por Pedido

```bash
curl -X GET http://localhost:3000/invoices/order/ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta**: Misma estructura que obtener por ID.

### Estructura de Datos

#### Campos Principales

- **`id`**: UUID de la factura en UniFoodApp
- **`siigoInvoiceId`**: ID de la factura en Siigo (puede ser null si falló la creación)
- **`invoiceNumber`**: Número consecutivo de factura (ej: "FE-001234")
- **`invoicePrefix`**: Prefijo de factura (generalmente "FE" para Factura Electrónica)
- **`customerName`**: Nombre del cliente
- **`customerDocument`**: NIT o CC del cliente
- **`customerDocumentType`**: Tipo de documento ("CC", "NIT", "CE")
- **`subtotal`**: Subtotal sin IVA
- **`tax`**: IVA (19% en Colombia)
- **`total`**: Total con IVA
- **`items`**: Array de items de la factura
- **`pdfUrl`**: URL del PDF de la factura en Siigo
- **`xmlUrl`**: URL del XML de la factura en Siigo
- **`status`**: Estado de la factura ("pending", "sent", "paid", "cancelled", "error")

### Flujo Automático

La facturación es **automática y asíncrona**:

1. **Cuándo se crea**: Cuando un pedido se completa exitosamente (pago aprobado)
2. **Qué pasa si falla**: Si la creación en Siigo falla, el pedido **NO se afecta**. La factura se guarda con estado "error" para referencia
3. **Guardado en BD**: Todas las facturas se guardan en la base de datos local, incluso si falló la creación en Siigo
4. **Reintentos**: El sistema no reintenta automáticamente. Si falla, se debe revisar manualmente

### Manejo de Errores

#### Errores Comunes de Siigo API

- **`SIIGO_CREDENTIALS_MISSING`**: Credenciales de Siigo no configuradas
- **`SIIGO_AUTH_FAILED`**: Error de autenticación con Siigo (credenciales inválidas)
- **`SIIGO_AUTH_ERROR`**: Error general de autenticación
- **`SIIGO_TOKEN_ERROR`**: No se pudo obtener token de acceso
- **`SIIGO_INVOICE_CREATION_ERROR`**: Error al crear factura en Siigo
- **`SIIGO_INVOICE_NOT_FOUND`**: Factura no encontrada en Siigo
- **`SIIGO_INVOICE_GET_ERROR`**: Error al obtener factura de Siigo
- **`SIIGO_PDF_ERROR`**: Error al obtener PDF de factura

#### Ejemplo de Error

```json
{
  "success": false,
  "message": "Error creando factura en Siigo: Cliente no encontrado",
  "statusCode": 400,
  "errorCode": "SIIGO_INVOICE_CREATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/orders"
}
```

**Nota**: Si la creación de factura falla, el pedido se crea normalmente. La factura se guarda con estado "error" y `siigoInvoiceId` null.

### Variables de Entorno

Las siguientes variables deben estar configuradas en `.env`:

```env
# Siigo API
SIIGO_API_URL=https://api.siigo.com
SIIGO_USERNAME=usuario@unifoodapp.com
SIIGO_ACCESS_KEY=access_key_xxxxx

# IDs de Configuración (opcionales, con valores por defecto)
SIIGO_DOCUMENT_ID=24446          # ID del tipo de documento
SIIGO_COST_CENTER=235            # ID del centro de costos
SIIGO_SELLER=629                 # ID del vendedor
SIIGO_TAX_ID=13156               # ID del impuesto IVA (19%)
SIIGO_PAYMENT_CASH_ID=5636       # ID de forma de pago efectivo
SIIGO_PAYMENT_CARD_ID=10462      # ID de forma de pago tarjeta
```

**Nota**: Siigo NO tiene un sandbox oficial. Para testing, se debe usar una empresa de prueba en Siigo Nube.

### Ejemplos de Uso

#### Consultar Factura de un Pedido

```bash
# 1. Crear pedido (se genera factura automáticamente)
ORDER_ID=$(curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "restaurant-uuid",
    "items": [...],
    "paymentSourceId": "card-uuid"
  }' | jq -r '.data.id')

# 2. Obtener factura del pedido
curl -X GET http://localhost:3000/invoices/order/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### Ver Factura por ID

```bash
curl -X GET http://localhost:3000/invoices/INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### Descargar PDF de Factura

Una vez obtenida la factura, el campo `pdfUrl` contiene la URL del PDF en Siigo:

```bash
# Obtener factura
INVOICE=$(curl -X GET http://localhost:3000/invoices/INVOICE_ID \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.pdfUrl')

# Descargar PDF (requiere autenticación con Siigo)
curl -X GET "$INVOICE" \
  -H "Authorization: Bearer SIIGO_TOKEN"
```

**Nota**: Para descargar el PDF directamente, se requiere un token de Siigo válido. El PDF se puede acceder desde el portal de Siigo o mediante la API de Siigo con las credenciales correspondientes.

### Permisos de Acceso

- **Estudiantes**: Solo pueden ver sus propias facturas (asociadas a sus pedidos)
- **Propietarios de restaurante**: Solo pueden ver facturas de pedidos de su restaurante
- **Administradores**: Pueden ver todas las facturas

Si intentas acceder a una factura que no te pertenece, recibirás un error `403 Forbidden`.

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

### Flujo Completo: Crear Pedido → Ver Factura Generada

```bash
# 1. Crear pedido (se genera factura automáticamente)
ORDER_RESPONSE=$(curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "restaurant-uuid",
    "items": [
      {
        "dishId": "dish-uuid",
        "dishNombre": "Pizza Margarita",
        "cantidad": 2,
        "precioUnitario": 15000,
        "precioTotal": 30000
      }
    ],
    "paymentSourceId": "card-uuid"
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.data.id')

# 2. Esperar unos segundos para que se procese la factura
sleep 3

# 3. Obtener factura del pedido
curl -X GET http://localhost:3000/invoices/order/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid",
    "orderId": "order-uuid",
    "siigoInvoiceId": "siigo-invoice-id",
    "invoiceNumber": "FE-001234",
    "invoicePrefix": "FE",
    "customerName": "Juan Pérez",
    "customerEmail": "juan.perez@universidadean.edu.co",
    "subtotal": 30000.00,
    "tax": 5700.00,
    "total": 35700.00,
    "pdfUrl": "https://api.siigo.com/invoices/siigo-invoice-id/pdf",
    "status": "sent",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Consultar Facturas de un Usuario

Actualmente no hay un endpoint para listar todas las facturas de un usuario. Para obtener una factura específica:

```bash
# Por ID de factura
curl -X GET http://localhost:3000/invoices/INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"

# Por ID de pedido
curl -X GET http://localhost:3000/invoices/order/ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
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

#### Pagos

- `PAYMENT_CARD_NOT_FOUND`: Tarjeta no encontrada
- `PAYMENT_NO_DEFAULT_CARD`: No tienes una tarjeta configurada
- `PAYMENT_CANNOT_DELETE_ONLY_CARD`: No puedes eliminar tu única tarjeta
- `PAYMENT_TRANSACTION_FAILED`: Error al procesar el pago
- `PAYMENT_WEBHOOK_INVALID_SIGNATURE`: Firma de webhook inválida
- `PAYMENT_CARD_CREATION_FAILED`: Error al crear tarjeta en Wompi
- `PAYMENT_DECLINED`: Pago rechazado por Wompi
- `PAYMENT_WOMPI_ERROR`: Error general de Wompi

#### Facturación (Siigo)

- `SIIGO_CREDENTIALS_MISSING`: Credenciales de Siigo no configuradas
- `SIIGO_AUTH_FAILED`: Error de autenticación con Siigo (credenciales inválidas)
- `SIIGO_AUTH_ERROR`: Error general de autenticación con Siigo
- `SIIGO_TOKEN_ERROR`: No se pudo obtener token de acceso de Siigo
- `SIIGO_INVOICE_CREATION_ERROR`: Error al crear factura en Siigo
- `SIIGO_INVOICE_NOT_FOUND`: Factura no encontrada en Siigo
- `SIIGO_INVOICE_GET_ERROR`: Error al obtener factura de Siigo
- `SIIGO_PDF_ERROR`: Error al obtener PDF de factura

**Nota**: Si la creación de factura en Siigo falla, el pedido se crea normalmente. La factura se guarda con estado "error" para referencia.

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



