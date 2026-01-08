# Guía de Testing de WebSockets - UniFoodApp

## Resumen

Los WebSockets permiten notificaciones en tiempo real para el sistema de pedidos. Esta guía explica cómo probar la funcionalidad completa.

## Requisitos Previos

1. Servidor corriendo: `npm run start:dev`
2. Base de datos con datos de prueba:
   - Al menos un restaurante activo
   - Al menos un usuario estudiante
   - Al menos un plato disponible

## Eventos Disponibles

### Eventos que el Cliente Emite

| Evento | Descripción | Payload |
|--------|-------------|---------|
| `join-restaurant-room` | Unirse a la sala de un restaurante | `{ restaurantId: string, userId?: string }` |
| `leave-restaurant-room` | Salir de la sala de un restaurante | `{ restaurantId: string }` |

### Eventos que el Servidor Emite

| Evento | Descripción | Cuándo se Emite |
|--------|-------------|-----------------|
| `new-order` | Nuevo pedido creado | Cuando un estudiante crea un pedido |
| `order-status-changed` | Estado del pedido cambió | Cuando el restaurante actualiza el estado |
| `joined-restaurant-room` | Confirmación de unión a sala | Después de `join-restaurant-room` |
| `left-restaurant-room` | Confirmación de salida de sala | Después de `leave-restaurant-room` |
| `error` | Error en la conexión | Cuando hay un error |

## Métodos de Testing

### 1. Script Automatizado (Recomendado)

El script `websocket-test.ts` proporciona una interfaz interactiva para probar WebSockets.

**Configuración**:
1. Edita `test/websocket-test.ts`
2. Configura `TEST_CONFIG.restaurantId` con un ID válido
3. (Opcional) Configura `TEST_CONFIG.userId` con un ID de estudiante

**Ejecución**:
```bash
npx ts-node test/websocket-test.ts
```

**Qué hace**:
- Crea un cliente restaurante que se une a la sala
- Crea un cliente estudiante (si se proporciona userId)
- Escucha y muestra todos los eventos en tiempo real
- Maneja reconexión automática

### 2. Postman WebSocket

1. Abre Postman
2. Crea nueva solicitud → Selecciona "WebSocket"
3. URL: `ws://localhost:3000/orders`
4. Click en "Connect"

**Unirse a sala**:
- En la pestaña "Messages", escribe:
  ```json
  {
    "event": "join-restaurant-room",
    "data": {
      "restaurantId": "tu-restaurant-id",
      "userId": "tu-user-id"
    }
  }
  ```
- Click en "Send"

**Escuchar eventos**:
- Los eventos aparecerán automáticamente en la pestaña "Messages"
- Filtra por tipo de evento para mejor organización

### 3. Cliente Personalizado

Puedes crear tu propio cliente usando `socket.io-client`:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/orders');

socket.on('connect', () => {
  socket.emit('join-restaurant-room', {
    restaurantId: 'restaurant-id',
    userId: 'user-id',
  });
});

socket.on('new-order', (data) => {
  console.log('Nuevo pedido:', data);
});
```

## Escenarios de Prueba

### Escenario 1: Nuevo Pedido

**Objetivo**: Verificar que el restaurante recibe notificación cuando se crea un pedido.

**Pasos**:
1. Conecta como restaurante y únete a la sala
2. Desde otro cliente (Postman REST, curl, etc.), crea un pedido:
   ```bash
   POST /orders
   Authorization: Bearer TOKEN_ESTUDIANTE
   {
     "restaurantId": "uuid",
     "items": [...]
   }
   ```
3. Verifica que el cliente WebSocket recibe `new-order` inmediatamente
4. Verifica que el payload contiene todos los datos del pedido

**Resultado esperado**: 
- Evento `new-order` recibido
- Payload completo con todos los campos del pedido
- Timestamp actual

### Escenario 2: Cambio de Estado

**Objetivo**: Verificar que usuario y restaurante reciben notificación cuando cambia el estado.

**Pasos**:
1. Conecta como restaurante y únete a la sala
2. (Opcional) Conecta como estudiante
3. Crea un pedido
4. Actualiza el estado del pedido:
   ```bash
   PATCH /orders/:id/status
   Authorization: Bearer TOKEN_RESTAURANTE
   {
     "status": "aceptado",
     "tiempoEstimado": 30
   }
   ```
5. Verifica que ambos clientes reciben `order-status-changed`

**Resultado esperado**:
- Evento `order-status-changed` recibido por restaurante
- Evento `order-status-changed` recibido por estudiante (si está conectado)
- Payload con el nuevo estado y fechas actualizadas

### Escenario 3: Cancelación

**Objetivo**: Verificar notificación cuando se cancela un pedido.

**Pasos**:
1. Conecta como restaurante y estudiante
2. Crea un pedido
3. Cancela el pedido:
   ```bash
   POST /orders/:id/cancel
   Authorization: Bearer TOKEN
   {
     "motivo": "Cliente canceló"
   }
   ```
4. Verifica que ambos reciben `order-status-changed` con status "cancelado"

**Resultado esperado**:
- Evento recibido con status "cancelado"
- Motivo de cancelación incluido

### Escenario 4: Reconexión Automática

**Objetivo**: Verificar que la reconexión funciona correctamente.

**Pasos**:
1. Conecta y únete a una sala
2. Desconecta el cliente (Ctrl+C o cerrar Postman)
3. Reconecta
4. Vuelve a unirte a la sala
5. Crea un pedido
6. Verifica que recibes el evento

**Resultado esperado**:
- Reconexión automática exitosa
- Eventos recibidos después de reconectar

### Escenario 5: Múltiples Clientes

**Objetivo**: Verificar que múltiples clientes en la misma sala reciben los mismos eventos.

**Pasos**:
1. Conecta 3 clientes diferentes (3 ventanas de Postman o 3 instancias del script)
2. Todos se unen a la misma sala de restaurante
3. Crea un pedido
4. Verifica que los 3 clientes reciben `new-order`

**Resultado esperado**:
- Todos los clientes reciben el mismo evento
- No hay duplicados
- No hay pérdida de mensajes

## Verificación de Logs

Revisa los logs del servidor para verificar:

1. **Conexiones**:
   ```
   [OrdersGateway] Cliente conectado: socket-id
   [OrdersGateway] Cliente se unió a la sala del restaurante restaurant-id
   ```

2. **Eventos emitidos**:
   ```
   [OrdersGateway] Notificando nuevo pedido #ABC-123 a la sala restaurant:uuid
   [OrdersGateway] Notificando cambio de estado del pedido #ABC-123 al usuario uuid
   ```

3. **Errores** (si los hay):
   ```
   [OrdersService] Error al emitir evento WebSocket para nuevo pedido: ...
   ```

## Troubleshooting

### No recibo eventos

1. **Verifica la conexión**:
   - ¿El servidor está corriendo?
   - ¿La URL es correcta? (`ws://localhost:3000/orders`)
   - ¿El namespace es `/orders`?

2. **Verifica que te uniste a la sala**:
   - ¿Emitiste `join-restaurant-room`?
   - ¿Recibiste `joined-restaurant-room`?
   - ¿El `restaurantId` es correcto?

3. **Verifica los logs del servidor**:
   - ¿Hay errores en los logs?
   - ¿Se están emitiendo los eventos?

### Eventos duplicados

- Asegúrate de no tener múltiples listeners para el mismo evento
- Verifica que no tengas múltiples conexiones activas
- Cierra conexiones anteriores antes de crear nuevas

### Reconexión no funciona

- Verifica que `reconnection: true` esté en la configuración del cliente
- Después de reconectar, debes volver a unirte a la sala
- El script de testing maneja esto automáticamente

### Errores de CORS

- Verifica que el servidor tenga CORS configurado para WebSockets
- Verifica que el origen del cliente esté en la lista de permitidos
- Revisa `orders.gateway.ts` para la configuración de CORS

## Mejores Prácticas

1. **Siempre maneja errores**: Escucha el evento `error`
2. **Reconexión automática**: Configura `reconnection: true`
3. **Re-unión después de reconectar**: Vuelve a unirte a las salas
4. **Logging**: Registra todos los eventos para debugging
5. **Testing incremental**: Prueba un escenario a la vez

## Próximos Pasos

Después de verificar que los WebSockets funcionan:

1. Integra con el frontend (React Native)
2. Implementa reconexión automática en la app
3. Agrega indicadores visuales de conexión
4. Implementa cola de mensajes para cuando esté desconectado

---

**Última actualización**: Día 13 - Testing de WebSockets
**Estado**: Documentación completa y scripts de testing listos ✅







