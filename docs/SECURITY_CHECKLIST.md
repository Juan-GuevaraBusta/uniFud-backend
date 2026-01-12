# Checklist de Validación de Seguridad - UniFoodApp Backend

Este documento proporciona un checklist completo para validar que todas las medidas de seguridad están correctamente implementadas y funcionando según las especificaciones del Día 18.

## Cómo usar este checklist

1. Revisar cada sección sistemáticamente
2. Ejecutar los procedimientos de verificación indicados
3. Marcar cada punto como completado (✅) o con observaciones (⚠️)
4. Documentar cualquier hallazgo o problema encontrado
5. Corregir problemas antes de marcar como completado

---

## 1. Rate Limiting

### Verificaciones

- [ ] Rate limiting activo globalmente (CustomThrottlerGuard aplicado en AppModule)
- [ ] Endpoints públicos tienen límites aplicados
- [ ] Límites específicos en endpoints sensibles:
  - [ ] `/auth/register` - 3 req/hora
  - [ ] `/auth/login` - 5 req/15min
  - [ ] `/auth/refresh` - 10 req/min
  - [ ] `/payments/webhooks` - 100 req/min
- [ ] Respuestas 429 incluyen headers `X-RateLimit-*` (Limit, Remaining, Reset)
- [ ] Mensaje de error 429 es apropiado y no expone información técnica

### Procedimiento de verificación

#### 1.1 Verificar configuración global

**Archivo:** `src/app.module.ts`

```bash
# Verificar que CustomThrottlerGuard está en providers con APP_GUARD
grep -A 5 "APP_GUARD" src/app.module.ts | grep -i "throttler"
```

**Resultado esperado:** Debe aparecer `CustomThrottlerGuard` en los providers con `APP_GUARD`.

#### 1.2 Verificar límites específicos en endpoints

**Archivos:**
- `src/auth/auth.controller.ts`
- `src/payments/payments.controller.ts`

```bash
# Verificar decoradores @Throttle en auth controller
grep -B 2 "@Throttle" src/auth/auth.controller.ts

# Verificar decorador @Throttle en payments controller
grep -B 2 "@Throttle" src/payments/payments.controller.ts
```

**Resultado esperado:**
- `/auth/register` debe tener `@Throttle` con límite de 3 req/hora
- `/auth/login` debe tener `@Throttle` con límite de 5 req/15min
- `/auth/refresh` debe tener `@Throttle` con límite de 10 req/min
- `/payments/webhooks` debe tener `@Throttle` con límite de 100 req/min

#### 1.3 Verificar manejo de respuestas 429

**Archivo:** `src/common/filters/all-exceptions.filter.ts`

```bash
# Verificar manejo de ThrottlerException y headers
grep -A 30 "ThrottlerException" src/common/filters/all-exceptions.filter.ts
```

**Resultado esperado:** Debe manejar `ThrottlerException`, establecer headers `X-RateLimit-*`, y proporcionar mensaje apropiado.

#### 1.4 Testing manual

Ver sección "Testing Manual - Rate Limiting" más abajo.

---

## 2. Validación y Sanitización de Inputs

### Verificaciones

- [ ] `SanitizePipe` aplicado globalmente en `main.ts`
- [ ] `ValidationPipe` configurado con `whitelist: true` y `forbidNonWhitelisted: true`
- [ ] Todos los DTOs tienen validaciones apropiadas (`@MaxLength`, `@IsEmail`, `@IsUUID`, etc.)
- [ ] Sanitización funciona para XSS, SQL injection, NoSQL injection

### Procedimiento de verificación

#### 2.1 Verificar pipes globales

**Archivo:** `src/main.ts`

```bash
# Verificar SanitizePipe y ValidationPipe
grep -A 15 "useGlobalPipes" src/main.ts
```

**Resultado esperado:**
- `SanitizePipe` debe estar antes de `ValidationPipe`
- `ValidationPipe` debe tener `whitelist: true` y `forbidNonWhitelisted: true`

#### 2.2 Verificar implementación de sanitización

**Archivo:** `src/common/pipes/sanitize.pipe.ts`

```bash
# Verificar patrones de sanitización
grep -E "sqlInjectionPatterns|nosqlInjectionPatterns|DOMPurify" src/common/pipes/sanitize.pipe.ts
```

**Resultado esperado:** Debe incluir patrones para SQL injection, NoSQL injection, y uso de DOMPurify para XSS.

#### 2.3 Verificar validaciones en DTOs

**Archivos de ejemplo:**
- `src/auth/dto/register.dto.ts`
- `src/orders/dto/create-order.dto.ts`

```bash
# Verificar validaciones en RegisterDto
grep -E "@IsEmail|@MaxLength|@MinLength" src/auth/dto/register.dto.ts

# Verificar validaciones en CreateOrderDto
grep -E "@IsUUID|@ArrayMaxSize|@MaxLength" src/orders/dto/create-order.dto.ts
```

**Resultado esperado:** DTOs deben tener validaciones apropiadas (email, UUID, longitud máxima, etc.).

#### 2.4 Testing manual

Ver sección "Testing Manual - Validaciones" más abajo.

---

## 3. API Keys y Variables de Entorno

### Verificaciones

- [ ] Ninguna API key hardcodeada en el código
- [ ] Todas las keys se obtienen de variables de entorno (`ConfigService` o `process.env`)
- [ ] `.env.example` existe y está completo
- [ ] `.env.example` no contiene valores reales
- [ ] Validación de variables de entorno activa en `app.module.ts`

### Procedimiento de verificación

#### 3.1 Auditoría de API keys

```bash
# Ejecutar script de auditoría
bash scripts/audit-api-keys.sh
```

**Resultado esperado:** No debe encontrar keys hardcodeadas.

#### 3.2 Verificar uso de variables de entorno

**Archivo:** `src/payments/providers/wompi.client.ts`

```bash
# Verificar uso de ConfigService
grep -A 10 "constructor" src/payments/providers/wompi.client.ts | grep -E "ConfigService|process.env"
```

**Resultado esperado:** Debe usar `ConfigService.get()` para obtener keys, no valores hardcodeados.

#### 3.3 Verificar validación de variables de entorno

**Archivo:** `src/config/env.validation.ts`

```bash
# Verificar función validate
grep -A 5 "export function validate" src/config/env.validation.ts
```

**Archivo:** `src/app.module.ts`

```bash
# Verificar que ConfigModule usa validate
grep -A 5 "ConfigModule.forRoot" src/app.module.ts | grep -i "validate"
```

**Resultado esperado:** `ConfigModule.forRoot` debe incluir `validate` en las opciones.

#### 3.4 Verificar .env.example

```bash
# Verificar que existe
test -f .env.example && echo "✅ .env.example existe" || echo "❌ .env.example no existe"

# Verificar que no contiene valores reales (solo ejemplos)
grep -E "WOMPI_PUBLIC_KEY|JWT_SECRET" .env.example | grep -v "example\|your_\|placeholder" && echo "⚠️  Verificar valores en .env.example" || echo "✅ .env.example parece seguro"
```

**Resultado esperado:** Debe existir y contener solo ejemplos/placeholders, no valores reales.

---

## 4. Tests de Seguridad

### Verificaciones

- [ ] Tests de rate limiting pasando (`test/security/rate-limiting.e2e-spec.ts`)
- [ ] Tests de validación y sanitización pasando (`test/security/validation.e2e-spec.ts`)
- [ ] Tests de API keys pasando (`test/security/api-keys.e2e-spec.ts`)

### Procedimiento de verificación

```bash
# Ejecutar tests de rate limiting
NODE_ENV=development npm run test:e2e -- rate-limiting.e2e-spec.ts

# Ejecutar tests de validación
NODE_ENV=development npm run test:e2e -- validation.e2e-spec.ts

# Ejecutar tests de API keys
NODE_ENV=development npm run test:e2e -- api-keys.e2e-spec.ts
```

**Resultado esperado:** Todos los tests deben pasar (0 fallos).

---

## 5. Documentación SECURITY.md

### Verificaciones

- [ ] Archivo `docs/SECURITY.md` existe
- [ ] Contiene sección de rotación de API keys
- [ ] Contiene checklist de seguridad
- [ ] Contiene mejores prácticas OWASP aplicadas
- [ ] Contiene troubleshooting
- [ ] Contiene procedimientos de manejo de incidentes

### Procedimiento de verificación

```bash
# Verificar existencia
test -f docs/SECURITY.md && echo "✅ SECURITY.md existe" || echo "❌ SECURITY.md no existe"

# Verificar secciones principales
grep -E "^##.*[Rr]otación|^##.*[Cc]hecklist|^##.*OWASP|^##.*[Tt]roubleshooting|^##.*[Ii]ncidente" docs/SECURITY.md
```

**Resultado esperado:** Todas las secciones deben estar presentes.

---

## 6. Headers de Seguridad

### Verificaciones

- [ ] Helmet configurado en `main.ts`
- [ ] Headers de seguridad configurados en `src/config/helmet.config.ts`:
  - [ ] Content-Security-Policy
  - [ ] HSTS (solo en producción)
  - [ ] X-Content-Type-Options
  - [ ] X-Frame-Options
  - [ ] X-XSS-Protection

### Procedimiento de verificación

#### 6.1 Verificar configuración de Helmet

**Archivo:** `src/main.ts`

```bash
# Verificar uso de helmet
grep -B 2 -A 2 "helmet" src/main.ts
```

**Resultado esperado:** Debe incluir `app.use(helmet(getHelmetConfig()))`.

#### 6.2 Verificar configuración de headers

**Archivo:** `src/config/helmet.config.ts`

```bash
# Verificar headers configurados
grep -E "contentSecurityPolicy|hsts|xContentTypeOptions|xFrameOptions|xXssProtection" src/config/helmet.config.ts
```

**Resultado esperado:** Todos los headers mencionados deben estar configurados.

#### 6.3 Testing manual

Ver sección "Testing Manual - Headers de Seguridad" más abajo.

---

## 7. Logging de Eventos de Seguridad

### Verificaciones

- [ ] LoggingInterceptor registrado globalmente
- [ ] Logging de eventos de seguridad activo:
  - [ ] Rate limit excedido (status 429)
  - [ ] Validaciones fallidas en endpoints de autenticación
  - [ ] Acceso a endpoints sensibles

### Procedimiento de verificación

#### 7.1 Verificar interceptor global

**Archivo:** `src/main.ts`

```bash
# Verificar LoggingInterceptor
grep -A 5 "useGlobalInterceptors" src/main.ts | grep -i "logging"
```

**Resultado esperado:** `LoggingInterceptor` debe estar en los interceptors globales.

#### 7.2 Verificar detección de eventos de seguridad

**Archivo:** `src/common/interceptors/logging.interceptor.ts`

```bash
# Verificar eventos de seguridad
grep -E "securityEvent|rate_limit|validation_failed|sensitiveEndpoint" src/common/interceptors/logging.interceptor.ts
```

**Resultado esperado:** Debe detectar y registrar eventos de seguridad (rate limit excedido, validaciones fallidas, endpoints sensibles).

#### 7.3 Testing manual

Ver sección "Testing Manual - Logging" más abajo.

---

## Testing Manual

### Rate Limiting

#### Probar límite general

```bash
# Hacer 101 requests rápidos (exceder límite de 100 req/min)
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
done | tail -5

# El último request debe retornar 429
```

#### Verificar headers X-RateLimit-*

```bash
# Hacer request y verificar headers
curl -i http://localhost:3000/ 2>/dev/null | grep -i "x-ratelimit"

# Debe mostrar:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: <timestamp>
```

#### Probar límite de registro (3 req/hora)

```bash
# Intentar registrar 4 usuarios (debe fallar el 4to)
for i in {1..4}; do
  curl -X POST http://localhost:3000/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@example.com\",\"password\":\"Test123!\",\"nombre\":\"Test $i\"}" \
    -w "\nStatus: %{http_code}\n" \
    -s | tail -1
  sleep 1
done

# El 4to request debe retornar 429
```

### Validaciones

#### Probar input malicioso (XSS)

```bash
# Intentar registrar con script XSS en el nombre
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test-xss@example.com","password":"Test123!","nombre":"<script>alert(\"XSS\")</script>Test"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

# El script debe ser sanitizado (no debe aparecer en la respuesta/BD)
```

#### Probar validación de email

```bash
# Intentar registrar con email inválido
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","password":"Test123!","nombre":"Test"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

# Debe retornar 400 Bad Request
```

#### Probar campos no permitidos (forbidNonWhitelisted)

```bash
# Intentar registrar con campo extra no permitido
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","nombre":"Test","campoNoPermitido":"valor"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

# Debe retornar 400 Bad Request
```

### Headers de Seguridad

#### Verificar headers con curl

```bash
# Hacer request y verificar headers de seguridad
curl -I http://localhost:3000/ 2>/dev/null | grep -E "Content-Security-Policy|X-Content-Type-Options|X-Frame-Options|X-XSS-Protection|Strict-Transport-Security"

# Debe mostrar:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: default-src 'self'; ...
# Strict-Transport-Security: (solo en producción)
```

### Verificación de Exposición de Información Sensible

#### Probar error sin exponer información sensible

```bash
# Hacer request que cause error 500
curl -X POST http://localhost:3000/nonexistent-endpoint \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}' \
  -s | jq .

# Verificar que la respuesta NO contiene:
# - JWT_SECRET
# - WOMPI_PRIVATE_KEY
# - Passwords
# - Stack traces detallados (en producción)
```

### Logging

#### Generar evento de seguridad (rate limit)

```bash
# Exceder rate limit y verificar logs
for i in {1..101}; do
  curl -s -o /dev/null http://localhost:3000/
done

# Revisar logs en logs/app.log o salida de consola
# Debe contener log de "Rate limit excedido" con contexto de seguridad
```

---

## Resumen de Verificación

Una vez completado el checklist, documentar:

- **Fecha de verificación:** ___________
- **Verificador:** ___________
- **Estado general:** ✅ Aprobado / ⚠️ Con observaciones / ❌ Rechazado

### Observaciones

- 
- 
- 

### Próximos pasos

- 
- 

---

## Referencias

- `docs/SECURITY.md` - Documentación completa de seguridad
- `scripts/audit-api-keys.sh` - Script de auditoría de API keys
- `test/security/*.e2e-spec.ts` - Tests de seguridad automatizados
