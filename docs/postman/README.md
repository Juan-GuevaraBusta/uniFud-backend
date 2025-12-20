# Postman Collection - UniFoodApp API

Esta carpeta contiene la colección completa de Postman para probar todos los endpoints de la API de UniFoodApp.

## 📦 Archivos

- **UniFoodApp-API.postman_collection.json**: Colección completa con todos los endpoints
- **UniFoodApp-Environment.postman_environment.json**: Variables de entorno para desarrollo

## 🚀 Instalación

### 1. Importar Collection

1. Abre Postman
2. Click en **Import** (esquina superior izquierda)
3. Selecciona el archivo `UniFoodApp-API.postman_collection.json`
4. Click en **Import**

### 2. Importar Environment

1. Click en **Import** nuevamente
2. Selecciona el archivo `UniFoodApp-Environment.postman_environment.json`
3. Click en **Import**

### 3. Seleccionar Environment

1. En la esquina superior derecha, selecciona **"UniFoodApp - Development"**
2. Verifica que `base_url` esté configurado como `http://localhost:3000`

## 📋 Uso

### Flujo Básico

1. **Registro y Login**:
   - Ejecuta `POST /auth/register` para crear un usuario
   - Ejecuta `POST /auth/confirm-email` (el código aparece en la consola del servidor)
   - Ejecuta `POST /auth/login` - El token se guarda automáticamente en las variables

2. **Usar Endpoints Protegidos**:
   - Todos los endpoints protegidos usan automáticamente el `access_token` guardado
   - No necesitas copiar/pegar el token manualmente

3. **Crear Recursos**:
   - Al crear un restaurante, plato, pedido, etc., el ID se guarda automáticamente
   - Puedes usar estos IDs en otros requests

### Variables Automáticas

La collection guarda automáticamente:

- `access_token`: Token JWT después del login
- `refresh_token`: Token de refresh después del login
- `user_id`: ID del usuario autenticado
- `user_role`: Rol del usuario (student, restaurant_owner, admin)
- `restaurant_id`: ID del restaurante creado
- `dish_id`: ID del plato creado
- `order_id`: ID del pedido creado
- `university_id`: ID de la universidad (debes configurarlo manualmente)
- `notification_token_id`: ID del token de notificación

### Scripts Automáticos

La collection incluye scripts que:

- **Guardan tokens** después del login/refresh
- **Guardan IDs** después de crear recursos
- **Validan respuestas** automáticamente

## 📁 Estructura de la Collection

```
UniFoodApp API
├── Autenticación
│   ├── Registro
│   ├── Confirmar Email
│   ├── Login (guarda tokens automáticamente)
│   ├── Reenviar Código
│   ├── Refresh Token
│   ├── Obtener Perfil
│   └── Logout
├── Usuarios
│   ├── Crear Usuario
│   ├── Listar Usuarios
│   ├── Obtener Usuario
│   ├── Actualizar Usuario
│   └── Eliminar Usuario
├── Universidades
│   ├── Crear Universidad
│   ├── Listar Universidades
│   ├── Filtrar por Ciudad
│   ├── Obtener Universidad
│   ├── Actualizar Universidad
│   └── Eliminar Universidad
├── Restaurantes
│   ├── Crear Restaurante (guarda restaurant_id)
│   ├── Listar Restaurantes
│   ├── Filtrar por Universidad
│   ├── Obtener Mi Restaurante
│   ├── Restaurantes por Universidad
│   ├── Obtener Restaurante
│   ├── Actualizar Restaurante
│   ├── Activar/Desactivar Restaurante
│   └── Eliminar Restaurante
├── Platos
│   ├── Crear Plato (guarda dish_id)
│   ├── Listar Platos
│   ├── Filtrar por Restaurante
│   ├── Menú del Restaurante
│   ├── Obtener Plato
│   ├── Actualizar Plato
│   ├── Activar/Desactivar Plato
│   ├── Agregar Topping
│   ├── Eliminar Topping
│   ├── Eliminar Plato
│   ├── Actualizar Disponibilidad
│   ├── Disponibilidad del Restaurante
│   ├── Menú con Disponibilidad
│   └── Actualización Masiva Disponibilidad
├── Pedidos
│   ├── Crear Pedido (guarda order_id)
│   ├── Listar Pedidos
│   ├── Obtener Pedido
│   ├── Pedidos del Restaurante
│   ├── Actualizar Estado
│   └── Cancelar Pedido
└── Notificaciones
    ├── Registrar Token (guarda notification_token_id)
    ├── Mis Tokens
    ├── Actualizar Token
    ├── Desactivar Token
    ├── Desactivar Todos los Tokens
    └── Enviar Notificación Manual
```

## 🔧 Configuración para Producción

Para usar en producción, crea un nuevo environment:

1. Click en el ícono de engranaje (Manage Environments)
2. Click en **Add**
3. Configura:
   - `base_url`: `https://api.unifoodapp.com`
   - Las demás variables se llenarán automáticamente al usar la API

## 📝 Notas

- Todos los endpoints protegidos requieren autenticación
- Los tokens se renuevan automáticamente cuando usas el endpoint de refresh
- Los IDs se guardan automáticamente al crear recursos
- Puedes ver/editar las variables en el panel de variables de Postman

## 🐛 Troubleshooting

### El token no se guarda

- Verifica que el environment esté seleccionado
- Revisa la consola de Postman (View → Show Postman Console)
- Asegúrate de que la respuesta del login incluya `accessToken`

### Variables no se actualizan

- Verifica que los scripts de test estén habilitados
- Revisa que el formato de la respuesta sea el esperado
- Algunos endpoints pueden devolver `data.accessToken` en lugar de `accessToken`

### Error 401 Unauthorized

- Verifica que hayas hecho login primero
- Revisa que el token no haya expirado
- Usa el endpoint de refresh token si es necesario

---

**Última actualización**: Enero 2024  
**Versión de la Collection**: 1.0.0


