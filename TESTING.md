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

**Última actualización**: Día 3 completado
**Estado**: Sistema de autenticación completo y funcional ✅


