# Guía de Testing - UniFoodApp API

## Estado del Proyecto

✅ **Completado (Día 1-3):**
- Configuración inicial de NestJS
- PostgreSQL configurado
- Módulo de Users completo
- **Módulo de Autenticación completo**
- Guards y decoradores implementados
- Swagger documentado

## Servidor

### Iniciar el servidor

```bash
cd uni-fud-backend
npm run start:dev
```

El servidor iniciará en:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs

---

## Formato de Respuestas Globales

- **Éxito**: todas las respuestas pasan por el `TransformInterceptor`, por lo que verás el formato:

```json
{
  "success": true,
  "data": { "...": "payload" },
  "timestamp": "2025-11-09T15:30:00.000Z"
}
```

- **Errores**: cualquier excepción es capturada por `AllExceptionsFilter` y devuelve:

```json
{
  "success": false,
  "message": "Detalle legible para humanos",
  "statusCode": 422,
  "errorCode": "IDENTIFICADOR_OPCIONAL",
  "timestamp": "2025-11-09T15:31:00.000Z",
  "path": "/ruta/solicitada"
}
```

> Los logs detallados de cada request se registran con el `LoggingInterceptor` (método, URL, usuario, tiempo de respuesta).

---

## Testing de Autenticación

### 1. Registro de Usuario

**Endpoint**: `POST /auth/register`

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "estudiante@universidadean.edu.co",
    "password": "Password123!",
    "nombre": "Juan Pérez",
    "role": "student"
  }'
```

**Respuesta esperada**:
```json
{
  "message": "Usuario registrado exitosamente. Por favor verifica tu email.",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Nota**: El código de verificación se mostrará en la consola del servidor.

---

### 2. Confirmar Email

**Endpoint**: `POST /auth/confirm-email`

```bash
curl -X POST http://localhost:3000/auth/confirm-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "estudiante@universidadean.edu.co",
    "code": "123456"
  }'
```

**Respuesta esperada**:
```json
{
  "message": "Email verificado exitosamente. Ya puedes iniciar sesión."
}
```

---

### 3. Login

**Endpoint**: `POST /auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "estudiante@universidadean.edu.co",
    "password": "Password123!"
  }'
```

**Respuesta esperada**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "estudiante@universidadean.edu.co",
    "nombre": "Juan Pérez",
    "role": "student",
    "emailVerified": true
  },
  "expiresIn": 1699123456789
}
```

**Importante**: Guarda el `accessToken` para las siguientes peticiones.

---

### 4. Obtener Perfil (Ruta Protegida)

**Endpoint**: `GET /auth/profile`

```bash
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer TU_ACCESS_TOKEN_AQUI"
```

**Respuesta esperada**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "estudiante@universidadean.edu.co",
  "role": "student",
  "emailVerified": true
}
```

---

### 5. Refrescar Token

**Endpoint**: `POST /auth/refresh`

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "TU_REFRESH_TOKEN_AQUI"
  }'
```

**Respuesta esperada**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 1699123456789
}
```

---

### 6. Reenviar Código de Verificación

**Endpoint**: `POST /auth/resend-code`

```bash
curl -X POST http://localhost:3000/auth/resend-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "estudiante@universidadean.edu.co"
  }'
```

---

## Casos de Prueba

### ✅ Flujo Completo Exitoso

1. Registrar usuario
2. Verificar código en consola
3. Confirmar email
4. Login
5. Acceder a ruta protegida con token

### ❌ Casos de Error

1. **Registro con email duplicado**
   - Status: 409 Conflict

2. **Login con credenciales incorrectas**
   - Status: 401 Unauthorized

3. **Login sin verificar email**
   - Status: 401 Unauthorized

4. **Acceso a ruta protegida sin token**
   - Status: 401 Unauthorized

5. **Código de verificación inválido**
   - Status: 400 Bad Request

6. **Token expirado**
   - Status: 401 Unauthorized

---

## Testing con Swagger

1. Abre http://localhost:3000/api/docs
2. Expande el endpoint que deseas probar
3. Click en "Try it out"
4. Completa los campos
5. Click en "Execute"

Para rutas protegidas:
1. Click en el botón "Authorize" (candado) en la parte superior
2. Ingresa: `Bearer TU_ACCESS_TOKEN`
3. Click en "Authorize"

---

## Testing de Pedidos (Días 7-8)

> Asegúrate de contar con:
> - Un usuario **student** autenticado (token JWT)
> - Un restaurante activo y al menos un plato disponible
> - El ID del restaurante (`restaurantId`) y del plato (`dishId`)

### Parámetros de paginación

Todos los listados (`GET /orders`, `GET /orders/restaurant/:id`) aceptan `page` y `limit` (por defecto 1 y 20, máximo 100). Ejemplo: `GET /orders?page=2&limit=10&status=preparando`.

### 1. Crear un pedido (estudiante)

**Endpoint**: `POST /orders`

```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN_STUDENT" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "RESTAURANT_UUID",
    "items": [
      {
        "dishId": "DISH_UUID",
        "dishNombre": "Pizza Margarita",
        "cantidad": 2,
        "precioUnitario": 18000,
        "precioTotal": 36000,
        "toppingsSeleccionados": [
          { "id": "TOPPING_UUID", "nombre": "Queso extra", "precio": 2000 }
        ],
        "toppingsBaseRemocionados": [
          { "id": "BASE_TOPPING_UUID", "nombre": "Cebolla" }
        ],
        "comentarios": "Sin sal, por favor"
      }
    ],
    "comentariosCliente": "Entregar en recepción"
  }'
```

### 2. Listar pedidos del estudiante

```bash
curl -X GET "http://localhost:3000/orders?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN_STUDENT"
```

### 3. Listar pedidos de un restaurante (propietario)

```bash
curl -X GET "http://localhost:3000/orders/restaurant/RESTAURANT_UUID?status=pendiente&page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN_OWNER"
```

### 4. Avanzar estado de un pedido (restaurante)

```bash
curl -X PATCH http://localhost:3000/orders/PEDIDO_UUID/status \
  -H "Authorization: Bearer $ACCESS_TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "aceptado",
    "tiempoEstimado": 20,
    "comentarios": "El pedido estará listo en 20 minutos"
  }'
```

Estados permitidos y transiciones:

```
PENDIENTE -> ACEPTADO -> PREPARANDO -> LISTO -> ENTREGADO
            \                          \
             \__________________________> CANCELADO (solo restaurante/admin)
PENDIENTE --------------------------------> CANCELADO (también estudiante)
```

### 5. Cancelar un pedido

- **Estudiante**: solo pedidos `pendiente`
- **Restaurante/Admin**: cualquier estado excepto `entregado`

```bash
curl -X PATCH http://localhost:3000/orders/PEDIDO_UUID/cancel \
  -H "Authorization: Bearer $ACCESS_TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{
    "motivo": "No hay ingredientes disponibles",
    "comentariosRestaurante": "Te contactaremos para ofrecer alternativas"
  }'
```

### 6. Validaciones y escenarios edge

- **Pedido duplicado pendiente**: intenta crear dos pedidos seguidos en el mismo restaurante. La API debe responder `errorCode: ORDER_ALREADY_PENDING`.
- **Categoría no válida**: crea/actualiza un plato con una categoría que el restaurante no posee; obtendrás `DISH_CATEGORY_INVALID`.
- **Estado inválido**: fuerza una transición no permitida (`LISTO -> ACEPTADO`) y confirma el error `ORDER_STATUS_TRANSITION_INVALID`.
- **Cancelación sin motivo**: envía `motivo` vacío y verifica el error `ORDER_CANCEL_REASON_REQUIRED`.
- **Restaurante inactivo**: desactiva un restaurante y trata de crear un pedido; espera `RESTAURANT_INACTIVE`.

---

## Testing de Platos (Día 5-6 + refinamientos)

### 1. Listar platos con paginación

```bash
curl -X GET "http://localhost:3000/dishes?page=1&limit=12" \
  -H "Content-Type: application/json"
```

- `restaurantId`, `categoria` y `search` pueden combinarse con `page/limit`.
- La respuesta incluye `data.items` y `data.meta` (total, página, totalPages).

### 2. Búsqueda pública con paginación

```bash
curl -X GET "http://localhost:3000/dishes?search=pizza&page=1&limit=5"
```

### 3. Validaciones clave

- Precio mayor a 1.000.000 → `DISH_PRICE_OUT_OF_RANGE`.
- Categoría fuera del catálogo del restaurante → `DISH_CATEGORY_INVALID`.
- Intentar actualizar disponibilidad desde otra cuenta → `DISH_AVAILABILITY_FORBIDDEN`.

---

## Testing de Usuarios (Admin)

Solo los administradores pueden consultar el listado global.

```bash
curl -X GET "http://localhost:3000/users?page=1&limit=25" \
  -H "Authorization: Bearer $ACCESS_TOKEN_ADMIN"
```

La respuesta incluye metadatos de paginación (`items`, `meta.total`, `meta.totalPages`).

---

## Testing de Notificaciones (Día 9)

Estas rutas gestionan los tokens Expo Push de los dispositivos.

### 1. Registrar/actualizar token del dispositivo

```bash
curl -X POST http://localhost:3000/notifications/register \
  -H "Authorization: Bearer $ACCESS_TOKEN_USUARIO" \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "deviceId": "iPhone 15 Pro",
    "platform": "ios",
    "deviceInfo": {
      "deviceName": "iPhone de Juan",
      "modelName": "iPhone 15 Pro",
      "osName": "iOS",
      "osVersion": "18.1"
    },
    "configuraciones": {
      "pedidosNuevos": true,
      "cambiosEstado": true,
      "promociones": false
    }
  }'
```

### 2. Listar tokens activos del usuario

```bash
curl -X GET http://localhost:3000/notifications/me \
  -H "Authorization: Bearer $ACCESS_TOKEN_USUARIO"
```

### 3. Actualizar preferencias o activar/desactivar un token específico

```bash
curl -X PATCH http://localhost:3000/notifications/TOKEN_UUID \
  -H "Authorization: Bearer $ACCESS_TOKEN_USUARIO" \
  -H "Content-Type: application/json" \
  -d '{
    "configuraciones": {
      "pedidosNuevos": false,
      "cambiosEstado": true,
      "promociones": false
    }
  }'
```

### 4. Desactivar un token (logout desde dispositivo)

```bash
curl -X DELETE http://localhost:3000/notifications/TOKEN_UUID \
  -H "Authorization: Bearer $ACCESS_TOKEN_USUARIO"
```

### 5. Desactivar todos los tokens del usuario (logout global)

```bash
curl -X DELETE http://localhost:3000/notifications \
  -H "Authorization: Bearer $ACCESS_TOKEN_USUARIO"
```

### 6. Enviar notificación manual (solo admin/restaurante)

```bash
curl -X POST http://localhost:3000/notifications/send \
  -H "Authorization: Bearer $ACCESS_TOKEN_OWNER_O_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["estudiante@universidadean.edu.co"],
    "type": "nuevo_pedido",
    "title": "🍽️ Nuevo pedido recibido",
    "body": "Pedido #ABC-123 por $25.000",
    "data": {
      "pedidoId": "PEDIDO_UUID",
      "numeroOrden": "#ABC-123"
    }
  }'
```

> ⚠️ **Nota:** además de este endpoint manual, la API envía notificaciones automáticas cuando se crean pedidos, cambian de estado o se cancelan. Asegúrate de tener tokens registrados para el restaurante y el usuario antes de probar esos flujos.

---

## Usuarios de Prueba

### Estudiante
```json
{
  "email": "estudiante@universidadean.edu.co",
  "password": "Password123!",
  "nombre": "Juan Pérez",
  "role": "student"
}
```

### Propietario de Restaurante
```json
{
  "email": "restaurante@universidadean.edu.co",
  "password": "Password123!",
  "nombre": "María García",
  "role": "restaurant_owner"
}
```

### Administrador
```json
{
  "email": "admin@unifoodapp.com",
  "password": "Admin123!",
  "nombre": "Admin UniFoodApp",
  "role": "admin"
}
```

---

## Próximos Pasos (Día 4-6)

Según el calendario de migración, los siguientes pasos son:

### Día 4: Módulos Universities y Restaurants
- Crear entidad University
- Crear entidad Restaurant
- Configurar relaciones
- Implementar CRUD completo

### Día 5: Módulo Dishes
- Crear entidad Dish
- Crear entidad Topping
- Implementar lógica de tipos de platos
- Sistema de toppings

### Día 6: Sistema de Disponibilidad
- Entidad DishAvailability
- Repository de disponibilidad
- Integración con Dishes
- API de actualización bulk

---

## Variables de Entorno Requeridas

Asegúrate de tener estas variables en tu archivo `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=unifood_admin
DB_PASSWORD=tu_password
DB_NAME=unifood_db

# JWT
JWT_SECRET=tu_secret_super_seguro_cambia_en_produccion
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=tu_refresh_secret_super_seguro
JWT_REFRESH_EXPIRATION=7d

# App
PORT=3000
NODE_ENV=development
```

---

## Notas de Desarrollo

1. **Hash de Password**: Se hace automáticamente en el hook `@BeforeInsert` de la entidad User
2. **Guards Globales**: JwtAuthGuard está configurado globalmente
3. **Rutas Públicas**: Usar decorador `@Public()` para rutas sin autenticación
4. **Roles**: Usar decorador `@Roles(UserRole.ADMIN)` + RolesGuard
5. **Usuario Actual**: Usar decorador `@CurrentUser()` para obtener usuario del request

---

## Troubleshooting

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo
- Verifica las credenciales en `.env`

### Error: "JWT secret not configured"
- Verifica que `JWT_SECRET` esté en `.env`

### Códigos de verificación no aparecen
- Revisa la consola del servidor (terminal donde corre `npm run start:dev`)

---

---

## Testing de WebSockets (Día 13)

Los WebSockets permiten notificaciones en tiempo real para pedidos. El servidor emite eventos cuando:
- Se crea un nuevo pedido → restaurante recibe `new-order`
- Cambia el estado de un pedido → usuario y restaurante reciben `order-status-changed`

### Configuración

El namespace de WebSockets es `/orders` y está disponible en:
```
ws://localhost:3000/orders
```

### Opción 1: Script de Testing Automatizado

Se incluye un script de testing en `test/websocket-test.ts`:

```bash
# Asegúrate de tener ts-node instalado
npm install --save-dev ts-node

# Ejecuta el script
npx ts-node test/websocket-test.ts
```

**Antes de ejecutar**, edita el archivo `test/websocket-test.ts` y configura:
- `restaurantId`: ID de un restaurante existente
- `userId`: ID de un usuario estudiante (opcional)

El script creará dos clientes:
1. **Cliente Restaurante**: Se une a la sala del restaurante y escucha nuevos pedidos
2. **Cliente Estudiante**: Escucha cambios de estado de sus pedidos

### Opción 2: Postman WebSocket

1. Abre Postman
2. Crea una nueva solicitud WebSocket
3. URL: `ws://localhost:3000/orders`
4. Conecta al servidor

#### Unirse a sala de restaurante

**Evento**: `join-restaurant-room`
**Payload**:
```json
{
  "restaurantId": "uuid-del-restaurante",
  "userId": "uuid-del-usuario"
}
```

**Respuesta esperada**:
```json
{
  "restaurantId": "uuid-del-restaurante",
  "room": "restaurant:uuid-del-restaurante"
}
```

#### Escuchar eventos

Una vez unido, escucharás automáticamente:

**Evento: `new-order`** (cuando se crea un pedido)
```json
{
  "order": {
    "id": "uuid",
    "numeroOrden": "#ABC-123",
    "userId": "uuid",
    "restaurantId": "uuid",
    "status": "pendiente",
    "items": [...],
    "subtotal": 15000,
    "tarifaServicio": 750,
    "total": 15750,
    "fechaPedido": "2025-12-11T..."
  },
  "timestamp": "2025-12-11T..."
}
```

**Evento: `order-status-changed`** (cuando cambia el estado)
```json
{
  "order": {
    "id": "uuid",
    "numeroOrden": "#ABC-123",
    "status": "aceptado",
    "tiempoEstimado": 30,
    "comentariosRestaurante": "En preparación",
    "fechaAceptado": "2025-12-11T...",
    "updatedAt": "2025-12-11T..."
  },
  "timestamp": "2025-12-11T..."
}
```

### Opción 3: Cliente JavaScript/TypeScript

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/orders', {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

// Conectar
socket.on('connect', () => {
  console.log('Conectado');
  
  // Unirse a sala de restaurante
  socket.emit('join-restaurant-room', {
    restaurantId: 'tu-restaurant-id',
    userId: 'tu-user-id',
  });
});

// Escuchar nuevos pedidos
socket.on('new-order', (data) => {
  console.log('Nuevo pedido:', data);
});

// Escuchar cambios de estado
socket.on('order-status-changed', (data) => {
  console.log('Estado cambiado:', data);
});

// Manejar errores
socket.on('error', (error) => {
  console.error('Error:', error);
});
```

### Flujo de Testing Completo

1. **Preparación**:
   - Inicia el servidor: `npm run start:dev`
   - Tener un restaurante creado y activo
   - Tener un usuario estudiante autenticado

2. **Conectar como restaurante**:
   - Usa Postman WebSocket o el script de testing
   - Conecta a `ws://localhost:3000/orders`
   - Emite `join-restaurant-room` con el `restaurantId`

3. **Crear pedido** (desde otro cliente):
   ```bash
   curl -X POST http://localhost:3000/orders \
     -H "Authorization: Bearer TOKEN_ESTUDIANTE" \
     -H "Content-Type: application/json" \
     -d '{
       "restaurantId": "uuid-restaurante",
       "items": [...]
     }'
   ```

4. **Verificar notificación**:
   - El cliente restaurante debe recibir `new-order` inmediatamente
   - Verifica que el payload contenga todos los datos del pedido

5. **Actualizar estado**:
   ```bash
   curl -X PATCH http://localhost:3000/orders/ORDER_ID/status \
     -H "Authorization: Bearer TOKEN_RESTAURANTE" \
     -H "Content-Type: application/json" \
     -d '{
       "status": "aceptado",
       "tiempoEstimado": 30
     }'
   ```

6. **Verificar notificación de cambio**:
   - El cliente restaurante debe recibir `order-status-changed`
   - Si el estudiante está conectado, también debe recibirlo

7. **Probar reconexión**:
   - Desconecta el cliente WebSocket
   - Reconecta
   - Vuelve a unirte a la sala
   - Verifica que siga recibiendo eventos

### Verificación de Múltiples Clientes

Para probar con múltiples clientes simultáneos:

1. Abre múltiples instancias de Postman WebSocket o ejecuta el script varias veces
2. Todos los clientes en la misma sala deben recibir los mismos eventos
3. Verifica que no haya duplicados ni pérdida de mensajes

### Troubleshooting WebSockets

**Error: "Cannot connect to WebSocket"**
- Verifica que el servidor esté corriendo
- Verifica que el puerto sea 3000
- Verifica la URL: debe ser `ws://localhost:3000/orders` (no `http://`)

**No recibo eventos**
- Verifica que te hayas unido a la sala con `join-restaurant-room`
- Verifica que el `restaurantId` sea correcto
- Revisa los logs del servidor para ver si hay errores

**Reconexión no funciona**
- El cliente debe tener `reconnection: true` en la configuración
- Después de reconectar, debes volver a unirte a la sala

**Eventos duplicados**
- Asegúrate de no estar escuchando el mismo evento múltiples veces
- Verifica que no tengas múltiples conexiones activas

---

**Última actualización**: Día 13 completado - WebSockets implementados y documentados ✅
**Estado**: Sistema de notificaciones en tiempo real completo y funcional ✅



