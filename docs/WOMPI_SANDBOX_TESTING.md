# Guía de Testing Manual con Wompi Sandbox

Esta guía proporciona instrucciones paso a paso para realizar testing manual de las integraciones con Wompi Sandbox usando Postman o curl.

## Tabla de Contenidos

1. [Prerequisitos](#prerequisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Datos de Prueba](#datos-de-prueba)
4. [Testing de Endpoints](#testing-de-endpoints)
5. [Flujo Completo](#flujo-completo)
6. [Verificación en Dashboard](#verificación-en-dashboard)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisitos

### Variables de Entorno Requeridas

Asegúrate de tener configuradas las siguientes variables en tu archivo `.env`:

```env
# Wompi Sandbox
WOMPI_API_URL=https://sandbox.wompi.co
WOMPI_PUBLIC_KEY=pub_test_xxxxx              # Tu clave pública de sandbox
WOMPI_PRIVATE_KEY=prv_test_xxxxx             # Tu clave privada de sandbox
WOMPI_INTEGRITY_SECRET=test_integrity_xxxxx  # Tu secret de integridad de sandbox
```

### Verificar Credenciales

Ejecuta el script de verificación antes de comenzar:

```bash
bash scripts/verify-wompi-credentials.sh
```

---

## Configuración Inicial

### 1. Iniciar el Servidor

```bash
cd uniFud-backend
npm run start:dev
```

El servidor debe iniciar en `http://localhost:3000` (o el puerto configurado).

### 2. Autenticarse

Para la mayoría de los endpoints necesitarás un token JWT. Primero, autentícate:

**POST /auth/login**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu-email@example.com",
    "password": "tu-password"
  }'
```

Guarda el `accessToken` de la respuesta para usarlo en los siguientes requests.

---

## Datos de Prueba

### Tarjetas de Prueba

Según la [documentación oficial de Wompi](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/):

#### Tarjeta Aprobada
- **Número**: `4242 4242 4242 4242`
- **Fecha de expiración**: Cualquier fecha futura (ej: `12/25`)
- **CVV**: Cualquier número de 3 dígitos (ej: `123`)
- **Resultado esperado**: Transacción `APPROVED`

#### Tarjeta Declinada
- **Número**: `4111 1111 1111 1111`
- **Fecha de expiración**: Cualquier fecha futura (ej: `12/25`)
- **CVV**: Cualquier número de 3 dígitos (ej: `123`)
- **Resultado esperado**: Transacción `DECLINED`

### Nequi de Prueba

#### Número Aprobado
- **Número de teléfono**: `3991111111`
- **Resultado esperado**: Transacción `APPROVED`

#### Número Declinado
- **Número de teléfono**: `3992222222`
- **Resultado esperado**: Transacción `DECLINED`

---

## Testing de Endpoints

### 1. Gestión de Tarjetas

#### ⚠️ IMPORTANTE: Tokenización de Tarjetas

La tokenización de tarjetas **debe hacerse desde el frontend usando Wompi.js**. El backend NO puede tokenizar tarjetas directamente.

**Proceso normal (desde frontend)**:
1. El usuario ingresa los datos de la tarjeta en el frontend
2. El frontend usa Wompi.js para tokenizar la tarjeta (obtiene un `token`)
3. El frontend también obtiene los `acceptanceToken` y `acceptPersonalAuth` desde Wompi.js
4. El frontend envía estos tokens al backend para crear el Payment Source

**Para testing manual con Postman**:
- Necesitarás obtener tokens reales desde Wompi.js o crear un Payment Source directamente en Wompi sandbox
- **Alternativa**: Usar el endpoint de Wompi API directamente para tokenizar (si está disponible)

#### POST /payments/cards - Agregar Tarjeta

**Requisitos**:
- Token JWT válido (Bearer token)
- Token de tarjeta tokenizada (desde Wompi.js o Wompi API)
- Acceptance tokens válidos

**Request**:

```bash
curl -X POST http://localhost:3000/payments/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "token": "tok_test_xxxxx",
    "acceptanceToken": "acceptance_token_xxxxx",
    "acceptPersonalAuth": "accept_personal_auth_xxxxx",
    "isDefault": true
  }'
```

**Respuesta exitosa (201)**:

```json
{
  "success": true,
  "data": {
    "id": "card_uuid",
    "userId": "user_uuid",
    "cardLastFour": "4242",
    "cardBrand": "VISA",
    "cardHolderName": "Juan Pérez",
    "expMonth": 12,
    "expYear": 2025,
    "isDefault": true,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Nota**: Este endpoint requiere tokens reales de Wompi.js. Para testing manual completo, considera crear un script de frontend temporal o usar la API de Wompi directamente si es posible.

#### GET /payments/cards - Listar Mis Tarjetas

**Request**:

```bash
curl -X GET http://localhost:3000/payments/cards \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta exitosa (200)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "card_uuid",
      "cardLastFour": "4242",
      "cardBrand": "VISA",
      "isDefault": true,
      "isActive": true
    }
  ]
}
```

#### GET /payments/cards/:id - Obtener Tarjeta Específica

**Request**:

```bash
curl -X GET http://localhost:3000/payments/cards/CARD_ID \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

#### PATCH /payments/cards/:id/default - Marcar como Default

**Request**:

```bash
curl -X PATCH http://localhost:3000/payments/cards/CARD_ID/default \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta exitosa (200)**:

```json
{
  "success": true,
  "data": {
    "id": "card_uuid",
    "isDefault": true
  }
}
```

#### DELETE /payments/cards/:id - Eliminar Tarjeta

**Request**:

```bash
curl -X DELETE http://localhost:3000/payments/cards/CARD_ID \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta exitosa (200)**:

```json
{
  "success": true,
  "message": "Tarjeta eliminada exitosamente"
}
```

---

### 2. Procesamiento de Pagos

Los pagos se procesan automáticamente al crear un pedido (`POST /orders`). Ver la sección de [Flujo Completo](#flujo-completo).

---

### 3. Webhooks de Wompi

#### POST /payments/webhooks - Recibir Webhook

Este endpoint es llamado por Wompi cuando hay cambios en las transacciones. Para testing manual, puedes simular un webhook:

**Request**:

```bash
curl -X POST http://localhost:3000/payments/webhooks \
  -H "Content-Type: application/json" \
  -H "x-signature: FIRMA_CALCULADA" \
  -d '{
    "event": {
      "id": "evt_test_123",
      "type": "transaction.updated"
    },
    "data": {
      "transaction": {
        "id": "tx_test_123",
        "status": "APPROVED",
        "reference": "UFD-123",
        "amount_in_cents": 10000,
        "currency": "COP",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    },
    "sent_at": "2024-01-15T10:30:01.000Z"
  }'
```

**Nota**: La firma (`x-signature`) debe calcularse correctamente usando el `WOMPI_INTEGRITY_SECRET`. Para testing real, configura el webhook URL en el dashboard de Wompi y usa ngrok para desarrollo local.

---

## Flujo Completo

### Flujo: Agregar Tarjeta → Crear Pedido → Procesar Pago

#### Paso 1: Agregar Tarjeta

⚠️ **Limitación**: Este paso requiere tokens reales de Wompi.js desde el frontend. 

**Para testing manual**, puedes:
1. Crear un Payment Source directamente en Wompi sandbox usando su API
2. O usar un script de frontend temporal con Wompi.js

**Ejemplo usando curl directo a Wompi API** (si tienes acceso):

```bash
# NOTA: Esto es solo para referencia. Normalmente se hace desde frontend con Wompi.js
curl -X POST https://sandbox.wompi.co/v1/tokens/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_WOMPI_PUBLIC_KEY" \
  -d '{
    "number": "4242424242424242",
    "cvc": "123",
    "exp_month": "12",
    "exp_year": "25",
    "card_holder": "Juan Pérez"
  }'
```

Luego usar ese token para crear el Payment Source y finalmente la tarjeta en nuestro backend.

#### Paso 2: Crear Pedido con Pago

Una vez que tengas una tarjeta agregada (con un Payment Source válido), puedes crear un pedido que procesará el pago automáticamente:

**POST /orders**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "restaurantId": "restaurant_uuid",
    "items": [
      {
        "dishId": "dish_uuid",
        "cantidad": 2,
        "precioUnitario": 15000
      }
    ],
    "paymentSourceId": "card_uuid",
    "comentariosCliente": "Sin cebolla por favor"
  }'
```

**Respuesta exitosa (201)**:

```json
{
  "success": true,
  "data": {
    "id": "order_uuid",
    "numeroOrden": "#001-001",
    "status": "PENDIENTE",
    "total": 31500,
    "payment": {
      "id": "payment_uuid",
      "status": "APPROVED",
      "wompiTransactionId": "tx_test_123"
    }
  }
}
```

**Si el pago es rechazado**, el pedido NO se crea y recibirás un error:

```json
{
  "success": false,
  "message": "Error al procesar el pago",
  "statusCode": 400,
  "errorCode": "PAYMENT_DECLINED"
}
```

---

## Verificación en Dashboard

### 1. Dashboard de Wompi

1. Accede a [https://comercios.wompi.co](https://comercios.wompi.co)
2. Inicia sesión con tus credenciales de sandbox
3. Ve a la sección "Transacciones"
4. Busca las transacciones por:
   - `reference` (formato UFD-XXX)
   - `transaction_id` (formato tx_test_xxxxx)

### 2. Verificar Estados

- **APPROVED**: Pago exitoso
- **PENDING**: Pago pendiente (esperando confirmación)
- **DECLINED**: Pago rechazado
- **ERROR**: Error en el procesamiento

### 3. Verificar Payment Sources

1. Ve a la sección "Fuentes de Pago" o "Payment Sources"
2. Verifica que las tarjetas agregadas aparezcan listadas
3. Verifica que el estado sea `AVAILABLE`

---

## Troubleshooting

### Error: "Token inválido" al agregar tarjeta

**Causa**: El token de tarjeta es inválido o expirado.

**Solución**:
1. Asegúrate de usar tokens generados recientemente (no expirados)
2. Verifica que estás usando Wompi.js correctamente en el frontend
3. Verifica que las credenciales de sandbox estén configuradas correctamente

### Error: "Payment Source no encontrado" al procesar pago

**Causa**: La tarjeta fue eliminada o el Payment Source no existe en Wompi.

**Solución**:
1. Verifica que la tarjeta existe en la base de datos
2. Verifica el estado del Payment Source en el dashboard de Wompi
3. Si la tarjeta fue eliminada, agrega una nueva tarjeta

### Error: "Transacción rechazada"

**Causa**: El pago fue rechazado por Wompi (tarjeta sin fondos, bloqueada, etc.).

**Solución**:
1. Para testing, usa la tarjeta de prueba `4242424242424242` (aprobada)
2. Evita usar `4111111111111111` (declinada) a menos que estés probando el manejo de errores
3. Verifica el mensaje de error en la respuesta para más detalles

### Webhook no se recibe

**Causa**: La URL del webhook no está configurada o no es accesible públicamente.

**Solución**:
1. Para desarrollo local, usa ngrok:
   ```bash
   ngrok http 3000
   ```
2. Configura la URL de ngrok en el dashboard de Wompi: `https://tu-url.ngrok.io/payments/webhooks`
3. Verifica que el endpoint esté accesible públicamente

### Credenciales no funcionan

**Causa**: Las credenciales no son de sandbox o están incorrectas.

**Solución**:
1. Ejecuta `bash scripts/verify-wompi-credentials.sh` para verificar
2. Asegúrate de que las keys tengan los prefijos correctos:
   - `pub_test_` para Public Key
   - `prv_test_` para Private Key
3. Verifica que `WOMPI_API_URL=https://sandbox.wompi.co`

---

## Checklist de Testing Manual

### UserCardsService

- [ ] **Crear tarjeta exitosamente**
  - [ ] Usar token válido de Wompi
  - [ ] Verificar que la tarjeta se guarda en BD
  - [ ] Verificar que aparece en el dashboard de Wompi

- [ ] **Listar tarjetas de usuario**
  - [ ] GET /payments/cards retorna las tarjetas correctas
  - [ ] Solo muestra tarjetas del usuario autenticado
  - [ ] Tarjetas inactivas no aparecen

- [ ] **Marcar tarjeta como default**
  - [ ] PATCH /payments/cards/:id/default marca como default
  - [ ] Otras tarjetas se desmarcan automáticamente
  - [ ] Solo el dueño puede marcar como default

- [ ] **Eliminar tarjeta**
  - [ ] DELETE /payments/cards/:id elimina correctamente
  - [ ] No se puede eliminar si hay pedidos pendientes (si aplica)
  - [ ] Solo el dueño puede eliminar

- [ ] **Validar ownership**
  - [ ] Usuario A no puede acceder a tarjetas de Usuario B
  - [ ] GET /payments/cards/:id de otra persona retorna 404

### PaymentsService

- [ ] **Procesar pago exitoso**
  - [ ] Crear pedido con tarjeta válida
  - [ ] Verificar que el pago se procesa
  - [ ] Verificar estado APPROVED en Wompi dashboard
  - [ ] Verificar que el pedido se crea correctamente

- [ ] **Procesar pago rechazado**
  - [ ] Usar tarjeta `4111111111111111` (declinada)
  - [ ] Verificar que el pedido NO se crea
  - [ ] Verificar mensaje de error apropiado
  - [ ] Verificar estado DECLINED en Wompi dashboard

- [ ] **Usar tarjeta default**
  - [ ] Crear pedido sin especificar paymentSourceId
  - [ ] Verificar que usa la tarjeta default automáticamente

- [ ] **Usar tarjeta específica**
  - [ ] Crear pedido especificando paymentSourceId
  - [ ] Verificar que usa la tarjeta especificada

- [ ] **Error si no hay tarjetas**
  - [ ] Intentar crear pedido sin tarjetas
  - [ ] Verificar mensaje de error apropiado

### Flujo Completo

- [ ] **Flujo exitoso completo**
  1. [ ] Agregar tarjeta (con token válido)
  2. [ ] Crear pedido con pago
  3. [ ] Verificar que pago se procesa exitosamente
  4. [ ] Verificar que pedido se crea
  5. [ ] Verificar transacción en Wompi dashboard
  6. [ ] Verificar que restaurante recibe notificación (si aplica)

- [ ] **Flujo con pago rechazado**
  1. [ ] Agregar tarjeta (con token válido)
  2. [ ] Crear pedido con tarjeta que será rechazada
  3. [ ] Verificar que pago es rechazado
  4. [ ] Verificar que pedido NO se crea
  5. [ ] Verificar mensaje de error

---

## Referencias

- [Documentación oficial de Wompi](https://docs.wompi.co)
- [Datos de prueba en Sandbox](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/)
- [Dashboard de Wompi Sandbox](https://comercios.wompi.co)
- [Wompi.js Documentation](https://docs.wompi.co/docs/colombia/usar-wompi-js/)

---

## Operaciones que Requieren Postman/Testing Manual

### Operaciones que NO pueden testearse completamente con tests automatizados

Las siguientes operaciones requieren tokens reales de Wompi.js y deben testearse manualmente con Postman o desde el frontend:

1. **POST /payments/cards - Agregar Tarjeta**
   - **Razón**: Requiere token de tarjeta tokenizada desde Wompi.js
   - **Testing**: Manual con Postman (si tienes tokens) o desde frontend con Wompi.js
   - **Alternativa**: Crear Payment Source directamente en Wompi dashboard y usar ese ID

2. **POST /orders - Crear Pedido con Pago**
   - **Razón**: Requiere Payment Source válido (tarjeta creada previamente)
   - **Testing**: Manual con Postman después de agregar tarjeta
   - **Puede testearse**: Una vez que tengas una tarjeta agregada

3. **POST /payments/webhooks - Recibir Webhooks**
   - **Razón**: Requiere configuración de URL pública (ngrok para local)
   - **Testing**: Configurar ngrok + dashboard de Wompi, o simular manualmente

### Operaciones que SÍ pueden testearse automatizadamente

Las siguientes operaciones pueden testearse con tests E2E o unitarios:

1. **GET /payments/cards - Listar Tarjetas**
   - Puede testearse con datos de prueba en BD

2. **GET /payments/cards/:id - Obtener Tarjeta**
   - Puede testearse con datos de prueba en BD

3. **PATCH /payments/cards/:id/default - Marcar como Default**
   - Puede testearse con datos de prueba en BD

4. **DELETE /payments/cards/:id - Eliminar Tarjeta**
   - Puede testearse con datos de prueba en BD

5. **WompiClient.verifyWebhookSignature()**
   - Puede testearse con payloads simulados (tests unitarios)

6. **WompiClient.getTransaction()**
   - Puede testearse con llamadas reales a Wompi API (si hay credenciales)

### Resumen: Qué Verificar con Postman

**Debes verificar manualmente con Postman**:

- ✅ **POST /payments/cards** - Agregar tarjeta (requiere tokens de Wompi.js)
- ✅ **POST /orders** - Crear pedido con pago completo
- ✅ **POST /payments/webhooks** - Recibir webhooks (requiere ngrok + configuración)

**Puedes verificar automáticamente** (tests E2E/unitarios):

- ✅ **GET /payments/cards** - Listar tarjetas
- ✅ **GET /payments/cards/:id** - Obtener tarjeta
- ✅ **PATCH /payments/cards/:id/default** - Marcar como default
- ✅ **DELETE /payments/cards/:id** - Eliminar tarjeta
- ✅ **WompiClient.verifyWebhookSignature()** - Verificar firmas
- ✅ **WompiClient.getTransaction()** - Consultar transacciones

---

## Notas Adicionales

### Tokenización desde Backend

**IMPORTANTE**: La tokenización de tarjetas normalmente se hace desde el frontend usando Wompi.js. El backend NO tokeniza tarjetas directamente por seguridad (cumplimiento PCI-DSS).

Si necesitas testing sin frontend, considera:
1. Crear un script de frontend temporal con Wompi.js
2. Usar la API de Wompi directamente (si está disponible para tokenización desde backend)
3. Crear Payment Sources manualmente en el dashboard de Wompi y usar esos IDs

### Acceptance Tokens

Los `acceptanceToken` y `acceptPersonalAuth` se obtienen desde Wompi.js en el frontend. Son tokens de aceptación de políticas de privacidad y tratamiento de datos personales.

**Para obtenerlos en testing**:
- Desde Wompi.js en el frontend (método recomendado)
- Consultar la documentación de Wompi.js para obtener estos tokens programáticamente

### Payment Sources de Prueba

Si necesitas Payment Sources para testing sin crear tarjetas completas, puedes:
1. Crearlos manualmente en el dashboard de Wompi
2. Usar la API de Wompi directamente (si tienes tokens válidos)
3. Crear un script de frontend temporal con Wompi.js

### Tarjetas de Prueba Recomendadas

Para testing, usa estas tarjetas de prueba de Wompi Sandbox:

- **Aprobada**: `4242424242424242` - Siempre resulta en `APPROVED`
- **Declinada**: `4111111111111111` - Siempre resulta en `DECLINED`
- Cualquier fecha futura y CVV de 3 dígitos funcionan
