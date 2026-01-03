# Integración Wompi - Datos Necesarios

Este documento lista la información que necesitamos de la documentación oficial de Wompi para completar la implementación.

## 📋 Información Requerida

### 1. Tokenización de Tarjetas (Frontend)

**Endpoint para tokenizar:**
- [ ] URL del endpoint (ej: `https://production.wompi.co/v1/tokens/cards`)
- [ ] Método HTTP (POST/GET)
- [ ] Headers requeridos (¿necesita Public Key o Private Key?)
- [ ] Estructura del request body:
  ```json
  {
    "number": "...",
    "cvc": "...",
    "exp_month": ...,
    "exp_year": ...,
    "card_holder": "..."
  }
  ```
- [ ] Estructura de la respuesta:
  ```json
  {
    "status": "...",
    "data": {
      "id": "tok_...",  // Este es el token que guardamos
      "last_four": "...",
      "brand": "...",
      // ¿Qué más campos devuelve?
    }
  }
  ```

### 2. Consultar Información de Token (Backend)

**Endpoint para obtener info de un token:**
- [ ] URL del endpoint (ej: `GET /v1/tokens/cards/:token` o `GET /v1/tokens/:token`)
- [ ] Método HTTP
- [ ] Headers requeridos (¿Private Key?)
- [ ] Estructura de la respuesta:
  ```json
  {
    "data": {
      "id": "tok_...",
      "last_four": "1234",
      "brand": "VISA",  // o "MASTERCARD", "AMEX", etc.
      "exp_month": 12,
      "exp_year": 2025,
      "card_holder": "Juan Pérez",
      // ¿Qué más campos devuelve?
    }
  }
  ```

### 3. Crear Transacción de Pago

**Endpoint para crear transacción:**
- [ ] URL del endpoint (ej: `POST /v1/transactions`)
- [ ] Headers requeridos
- [ ] Estructura del request body:
  ```json
  {
    "amount_in_cents": 50000,
    "currency": "COP",
    "customer_email": "...",
    "payment_method": {
      "type": "CARD",
      "token": "tok_...",
      "installments": 1
    },
    "reference": "UNIFOOD-...",
    // ¿Qué más campos son requeridos/opcionales?
  }
  ```
- [ ] Estructura de la respuesta:
  ```json
  {
    "data": {
      "id": "transaction_id",
      "status": "APPROVED" | "PENDING" | "DECLINED",
      "amount_in_cents": 50000,
      "payment_method": {
        "type": "CARD",
        "extra": {
          "last_four": "1234",
          "brand": "VISA"
        }
      },
      // ¿Qué más campos devuelve?
    }
  }
  ```

### 4. Consultar Transacción

**Endpoint para consultar estado:**
- [ ] URL del endpoint (ej: `GET /v1/transactions/:id`)
- [ ] Headers requeridos
- [ ] Estructura de la respuesta

### 5. Webhooks

**Configuración de webhooks:**
- [ ] Cómo configurar la URL del webhook en el dashboard de Wompi
- [ ] Estructura del payload del webhook:
  ```json
  {
    "event": {
      "id": "...",
      "type": "transaction.updated"
    },
    "data": {
      "transaction": {
        "id": "...",
        "status": "...",
        // ¿Qué más campos?
      }
    },
    "sent_at": "..."
  }
  ```
- [ ] Cómo verificar la firma del webhook:
  - [ ] Header que contiene la firma (ej: `X-Signature`)
  - [ ] Algoritmo de verificación (SHA256?)
  - [ ] Cómo construir el string a hashear
  - [ ] Secret a usar (¿es el `WOMPI_INTEGRITY_SECRET`?)

### 6. Autenticación

**API Keys:**
- [ ] ¿Dónde se obtienen las API keys? (Dashboard de Wompi)
- [ ] Diferencia entre Public Key y Private Key:
  - [ ] ¿Cuál se usa para tokenizar? (probablemente Public Key)
  - [ ] ¿Cuál se usa para crear transacciones? (probablemente Private Key)
  - [ ] ¿Cuál se usa para consultar tokens? (probablemente Private Key)
- [ ] ¿Hay diferentes keys para sandbox y producción?

### 7. URLs y Ambientes

- [ ] URL de producción: `https://production.wompi.co`
- [ ] URL de sandbox: `https://sandbox.wompi.co` (o similar)
- [ ] ¿Cómo cambiar entre ambientes?

### 8. Códigos de Estado

- [ ] Lista de estados posibles de transacciones:
  - `APPROVED` - Pago aprobado
  - `PENDING` - Pendiente
  - `DECLINED` - Rechazado
  - `VOIDED` - Anulado
  - ¿Hay más?
- [ ] Códigos de error comunes y sus significados

### 9. Validaciones y Límites

- [ ] ¿Hay límites de monto mínimo/máximo?
- [ ] ¿Qué validaciones hace Wompi automáticamente?
- [ ] ¿Cómo manejar tarjetas rechazadas?

### 10. SDKs y Librerías

- [ ] ¿Wompi tiene SDK para React Native?
- [ ] ¿Cuál es el nombre del paquete npm?
- [ ] ¿Hay documentación específica para React Native?

---

## 📝 Notas de Implementación

### Archivos que necesitan ajustes según la documentación:

1. **`src/payments/providers/wompi.client.ts`**
   - Método `getCardInfo()` - Ajustar endpoint y mapeo de respuesta
   - Método `createTransaction()` - Ajustar estructura del payload
   - Método `verifyWebhookSignature()` - Implementar algoritmo de verificación

2. **`src/payments/user-cards.service.ts`**
   - Ya está preparado para usar `getCardInfo()` de WompiClient

3. **Frontend (React Native)**
   - Implementar tokenización usando SDK de Wompi
   - Enviar solo el token al backend

---

## ✅ Checklist de Implementación

Una vez tengas la documentación:

- [ ] Ajustar `WompiClient.getCardInfo()` con endpoint y estructura correctos
- [ ] Ajustar `WompiClient.createTransaction()` con payload correcto
- [ ] Implementar `WompiClient.verifyWebhookSignature()` con algoritmo correcto
- [ ] Configurar variables de entorno (Public Key, Private Key, Integrity Secret)
- [ ] Probar tokenización en frontend
- [ ] Probar creación de tarjeta en backend
- [ ] Probar creación de transacción
- [ ] Configurar webhook y probar
- [ ] Testing con sandbox de Wompi

---

**Última actualización**: Pendiente de revisar documentación oficial de Wompi

