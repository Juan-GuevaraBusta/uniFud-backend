# Guía de Troubleshooting - UniFoodApp Backend

## Tabla de Contenidos

1. [Problemas Comunes de Wompi](#problemas-comunes-de-wompi)
2. [Problemas de Webhooks](#problemas-de-webhooks)
3. [Problemas de Tarjetas](#problemas-de-tarjetas)
4. [Problemas de Base de Datos](#problemas-de-base-de-datos)
5. [Problemas de Autenticación](#problemas-de-autenticación)
6. [Logs y Debugging](#logs-y-debugging)

---

## Problemas Comunes de Wompi

### Error: "Token inválido" al crear Payment Source

**Síntomas**:
- Error 400 al intentar agregar una tarjeta
- Mensaje: "Error al crear Payment Source en Wompi"

**Causas posibles**:
1. Token de Wompi.js expirado o inválido
2. Acceptance token no válido
3. Configuración incorrecta de Wompi en el frontend

**Soluciones**:
1. Verificar que el token se genera correctamente en el frontend usando Wompi.js
2. Asegurarse de que los acceptance tokens son válidos y no han expirado
3. Verificar que se está usando el ambiente correcto (sandbox vs producción)
4. Revisar los logs del servidor para ver el error específico de Wompi

**Ejemplo de log**:
```
❌ Error creando Payment Source: [detalles del error]
```

### Error: "Payment Source no encontrado" al crear transacción

**Síntomas**:
- Error al procesar un pago
- Mensaje: "Error al procesar el pago"

**Causas posibles**:
1. El Payment Source fue eliminado en Wompi
2. El Payment Source no está disponible
3. La tarjeta fue eliminada localmente pero el Payment Source aún existe en Wompi

**Soluciones**:
1. Verificar que la tarjeta existe y está activa en la base de datos
2. Verificar el estado del Payment Source en el dashboard de Wompi
3. Si la tarjeta fue eliminada, el usuario debe agregar una nueva tarjeta

### Error: "Transacción rechazada" o estado DECLINED

**Síntomas**:
- El pago no se completa
- Estado de transacción: DECLINED

**Causas posibles**:
1. Tarjeta sin fondos
2. Tarjeta bloqueada o expirada
3. Límite de transacción excedido
4. Datos de tarjeta incorrectos

**Soluciones**:
1. Verificar el mensaje de error específico en `status_message` de la transacción
2. Solicitar al usuario que verifique su tarjeta
3. Probar con una tarjeta de prueba de Wompi sandbox
4. Revisar los logs de Wompi en el dashboard

**Tarjetas de prueba Wompi Sandbox**:
- Visa aprobada: `4242424242424242`
- Visa rechazada: `4000000000000002`
- Visa con 3D Secure: `4000000000003220`

### Error: "Integrity Secret no configurado"

**Síntomas**:
- Warning en logs sobre Integrity Secret
- Webhooks no se verifican correctamente

**Soluciones**:
1. Verificar que `WOMPI_INTEGRITY_SECRET` está configurado en `.env`
2. Obtener el Integrity Secret del dashboard de Wompi
3. Asegurarse de usar el secret correcto para el ambiente (sandbox vs producción)

---

## Problemas de Webhooks

### Webhook no se recibe

**Síntomas**:
- Los estados de transacción no se actualizan automáticamente
- No se reciben eventos de Wompi

**Causas posibles**:
1. URL del webhook no configurada en Wompi
2. URL del webhook no es accesible públicamente
3. Firewall bloqueando las peticiones de Wompi

**Soluciones**:
1. Configurar la URL del webhook en el dashboard de Wompi:
   - Sandbox: `https://tu-dominio-staging.com/payments/webhooks`
   - Producción: `https://tu-dominio.com/payments/webhooks`
2. Usar ngrok para desarrollo local:
   ```bash
   ngrok http 3000
   # Usar la URL de ngrok en el dashboard de Wompi
   ```
3. Verificar que el endpoint está accesible:
   ```bash
   curl -X POST https://tu-dominio.com/payments/webhooks \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```
4. Revisar los logs del servidor para ver si se reciben las peticiones

### Error: "Firma de webhook inválida"

**Síntomas**:
- Error 400 al recibir webhook
- Mensaje: "Firma de webhook inválida"

**Causas posibles**:
1. Integrity Secret incorrecto
2. Firma calculada incorrectamente
3. Datos del webhook modificados

**Soluciones**:
1. Verificar que `WOMPI_INTEGRITY_SECRET` coincide con el configurado en Wompi
2. Verificar que la firma se calcula correctamente:
   ```
   SHA256(reference + amount_in_cents + currency + integrity_secret)
   ```
3. Revisar los logs para ver la firma esperada vs recibida
4. En desarrollo, se puede procesar sin firma (no recomendado en producción)

**Debug**:
```typescript
// Los logs mostrarán:
⚠️ Firma de webhook inválida. Esperada: [hash], Recibida: [signature]
```

### Webhook procesado pero pago no encontrado

**Síntomas**:
- Webhook recibido correctamente
- Warning: "Pago no encontrado para transacción"

**Causas posibles**:
1. La transacción fue creada fuera del sistema
2. El `wompi_transaction_id` no coincide
3. La transacción fue eliminada de la base de datos

**Soluciones**:
1. Verificar que la transacción existe en la base de datos
2. Verificar el `wompi_transaction_id` en los logs
3. Si es una transacción externa, puede ignorarse (es normal)

---

## Problemas de Tarjetas

### Error: "No tienes una tarjeta configurada"

**Síntomas**:
- Error al intentar procesar un pago
- Mensaje: "No tienes una tarjeta configurada"

**Soluciones**:
1. El usuario debe agregar una tarjeta primero
2. Verificar que la tarjeta está marcada como `isDefault: true`
3. Verificar que la tarjeta está activa (`isActive: true`)

### Error: "No puedes eliminar tu única tarjeta"

**Síntomas**:
- Error 400 al intentar eliminar una tarjeta
- Mensaje: "No puedes eliminar tu única tarjeta"

**Soluciones**:
1. El usuario debe agregar otra tarjeta antes de eliminar la actual
2. O marcar otra tarjeta como default antes de eliminar

### Tarjeta creada pero no aparece en la lista

**Síntomas**:
- Tarjeta creada exitosamente pero no se muestra al listar

**Causas posibles**:
1. La tarjeta está marcada como `isActive: false`
2. Filtro de usuario incorrecto

**Soluciones**:
1. Verificar que `isActive: true` en la base de datos
2. Verificar que se está filtrando por `userId` correcto
3. Revisar los logs para ver qué tarjetas se están retornando

---

## Problemas de Base de Datos

### Error: "role postgres does not exist" al ejecutar migraciones

**Síntomas**:
- Error al ejecutar `npm run migration:run`
- Mensaje: "role postgres does not exist"

**Soluciones**:
1. Verificar que el usuario de PostgreSQL existe:
   ```bash
   psql -U $(whoami) -d postgres -c "\du"
   ```
2. Actualizar `DB_USERNAME` en `.env` con un usuario válido
3. Verificar que `src/data-source.ts` carga correctamente el `.env`

### Error: "relation payments does not exist"

**Síntomas**:
- Error al intentar usar la tabla payments
- Tabla no existe en la base de datos

**Soluciones**:
1. Ejecutar las migraciones:
   ```bash
   npm run migration:run
   ```
2. Verificar que las migraciones se ejecutaron correctamente:
   ```bash
   psql -U $DB_USERNAME -d $DB_NAME -c "\dt payments"
   ```
3. Si las migraciones fallan, revisar los logs de error

### Error: "duplicate key value violates unique constraint"

**Síntomas**:
- Error al crear un pago o tarjeta
- Violación de constraint único

**Causas posibles**:
1. `wompi_transaction_id` duplicado
2. `reference` duplicado
3. `wompi_payment_source_id` duplicado

**Soluciones**:
1. Verificar que no se está intentando crear un registro duplicado
2. Revisar la lógica de generación de referencias
3. Verificar que los IDs de Wompi son únicos

---

## Problemas de Autenticación

### Error: "Usuario no encontrado" en PaymentsService

**Síntomas**:
- Error al procesar un pago
- Mensaje: "Usuario no encontrado"

**Soluciones**:
1. Verificar que el `userId` del token JWT es válido
2. Verificar que el usuario existe en la base de datos
3. Verificar que el token no ha expirado

---

## Logs y Debugging

### Habilitar logs detallados

**En desarrollo**:
```typescript
// Los logs ya están habilitados por defecto en desarrollo
// Revisar la consola del servidor
```

**En producción**:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Ver logs de Wompi

Los logs de Wompi se muestran en la consola con prefijos:
- `✅` - Operación exitosa
- `❌` - Error
- `⚠️` - Advertencia

**Ejemplo de logs**:
```
[PaymentsService] Procesando pago para usuario user_123, monto: 100 COP
[WompiClient] Creando transacción en Wompi para referencia: UFD-123
✅ Transacción creada: tx_test_123 - Status: APPROVED
✅ Estado de pago actualizado: payment_123 - Status: APPROVED
```

### Verificar estado de transacciones en Wompi

1. Acceder al dashboard de Wompi
2. Ir a "Transacciones"
3. Buscar por `reference` o `transaction_id`
4. Verificar el estado y los detalles de la transacción

### Testing con Sandbox

**Configurar variables de entorno para sandbox**:
```env
WOMPI_API_URL=https://sandbox.wompi.co
WOMPI_PUBLIC_KEY=pub_test_xxxxx
WOMPI_PRIVATE_KEY=prv_test_xxxxx
WOMPI_INTEGRITY_SECRET=test_integrity_xxxxx
```

**Tarjetas de prueba**:
- Visa aprobada: `4242424242424242`
- Visa rechazada: `4000000000000002`
- Cualquier fecha de expiración futura
- Cualquier CVV de 3 dígitos

---

## Contacto y Soporte

Para problemas adicionales:
1. Revisar la documentación oficial de Wompi: https://docs.wompi.co
2. Revisar los logs del servidor
3. Verificar la configuración en el dashboard de Wompi
4. Contactar al equipo de desarrollo

