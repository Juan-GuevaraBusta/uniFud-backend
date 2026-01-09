# Documentación de Seguridad - UniFoodApp Backend

## 1. Introducción

Este documento describe las medidas de seguridad implementadas en el backend de UniFoodApp, siguiendo las mejores prácticas de OWASP (Open Web Application Security Project).

### Propósito

- Guiar a los desarrolladores en la implementación de seguridad
- Documentar procesos de rotación de API keys
- Proporcionar checklist de seguridad
- Documentar procedimientos de respuesta a incidentes

### Alcance

Este documento cubre:
- Protección contra ataques comunes (XSS, SQL injection, timing attacks)
- Manejo seguro de API keys y secretos
- Validación y sanitización de inputs
- Headers de seguridad
- Logging seguro
- Rotación de credenciales

---

## 2. Rotación de API Keys

### 2.1 Wompi API Keys

**Variables de entorno afectadas**:
- `WOMPI_PUBLIC_KEY`
- `WOMPI_PRIVATE_KEY`
- `WOMPI_INTEGRITY_SECRET`

**Proceso de rotación sin downtime**:

1. **Preparación**:
   ```bash
   # 1. Obtener nuevas keys del dashboard de Wompi
   # 2. Preparar archivo .env.new con las nuevas keys
   ```

2. **Implementación**:
   ```bash
   # 1. Agregar nuevas keys como variables adicionales (opcional)
   # WOMPI_PUBLIC_KEY_NEW=...
   # WOMPI_PRIVATE_KEY_NEW=...
   # WOMPI_INTEGRITY_SECRET_NEW=...
   
   # 2. Actualizar código para soportar ambas keys temporalmente (si es necesario)
   # 3. Actualizar .env con nuevas keys principales
   ```

3. **Despliegue**:
   - Deploy a staging primero
   - Verificar que los pagos funcionen correctamente
   - Deploy a producción durante horario de bajo tráfico
   - Monitorear logs por 24 horas

4. **Limpieza**:
   - Después de 48 horas sin problemas, eliminar keys antiguas del código

**Notas importantes**:
- Wompi permite tener múltiples keys activas simultáneamente
- Las transacciones creadas con la key antigua seguirán funcionando
- Los webhooks seguirán funcionando con la key antigua durante el período de transición

---

### 2.2 Siigo API Keys

**Variables de entorno afectadas**:
- `SIIGO_USERNAME`
- `SIIGO_ACCESS_KEY`
- `SIIGO_DOCUMENT_ID` (si cambia)

**Proceso de rotación sin downtime**:

1. **Preparación**:
   - Generar nuevo Access Key en el dashboard de Siigo
   - Obtener credenciales completas

2. **Implementación**:
   ```bash
   # 1. Actualizar variables de entorno
   # SIIGO_USERNAME=nuevo_usuario
   # SIIGO_ACCESS_KEY=nueva_key
   
   # 2. Verificar conexión con nuevas credenciales en staging
   ```

3. **Despliegue**:
   - Deploy a staging
   - Probar creación de facturas
   - Deploy a producción
   - Monitorear facturación por 24 horas

**Notas importantes**:
- Siigo requiere autenticación antes de cada operación
- El token de acceso se regenera con las nuevas credenciales automáticamente

---

### 2.3 JWT Secrets

**Variables de entorno afectadas**:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

**Proceso de rotación sin downtime (complejo)**:

⚠️ **ADVERTENCIA**: La rotación de JWT secrets invalida todos los tokens existentes. Esto requiere una estrategia especial.

**Opción 1: Rotación con período de gracia (recomendado)**:

1. **Preparación**:
   ```bash
   # 1. Generar nuevos secrets (mínimo 32 caracteres)
   # JWT_SECRET_NEW=...
   # JWT_REFRESH_SECRET_NEW=...
   ```

2. **Implementación temporal (dual secrets)**:
   ```typescript
   // Modificar auth.service.ts para aceptar ambos secrets
   // Verificar tokens con el secret antiguo o nuevo
   // Generar tokens solo con el nuevo secret
   ```

3. **Comunicación a usuarios**:
   - Notificar que deben reiniciar sesión
   - Implementar re-login automático cuando el token antiguo expire

4. **Despliegue**:
   - Deploy con soporte para ambos secrets
   - Esperar a que todos los tokens antiguos expiren (1 hora para access, 7 días para refresh)
   - Remover soporte para secret antiguo después del período de gracia

**Opción 2: Rotación forzada (mantenimiento programado)**:

1. Notificar a usuarios con anticipación
2. Programar ventana de mantenimiento
3. Invalidar todos los tokens existentes
4. Usuarios deben hacer login nuevamente

**Notas importantes**:
- Esta es una operación crítica que afecta a todos los usuarios
- Considerar implementar soporte para múltiples secrets si es necesario

---

## 3. Checklist de Seguridad

### Pre-Deployment

- [ ] Todas las variables de entorno están configuradas en el servidor
- [ ] No hay API keys hardcodeadas en el código
- [ ] `.env` está en `.gitignore`
- [ ] `.env.example` está actualizado y no contiene valores reales
- [ ] Rate limiting está configurado
- [ ] Headers de seguridad (Helmet) están configurados
- [ ] CORS está configurado correctamente
- [ ] Validación de inputs está implementada
- [ ] Sanitización de inputs está implementada
- [ ] Logs no contienen información sensible
- [ ] Tests de seguridad pasan
- [ ] Documentación está actualizada

### Post-Deployment

- [ ] Verificar que headers de seguridad estén presentes
- [ ] Verificar que rate limiting funcione
- [ ] Verificar que logs no expongan información sensible
- [ ] Monitorear logs por 24 horas
- [ ] Verificar que no haya errores relacionados con seguridad
- [ ] Realizar pruebas de penetración básicas

### Revisión Periódica (Mensual)

- [ ] Revisar logs de seguridad
- [ ] Verificar que no haya vulnerabilidades conocidas en dependencias (`npm audit`)
- [ ] Revisar configuración de rate limiting
- [ ] Revisar configuración de CORS
- [ ] Actualizar dependencias de seguridad
- [ ] Revisar accesos y permisos
- [ ] Rotar API keys si es necesario (recomendado cada 90 días)
- [ ] Revisar y actualizar documentación de seguridad

---

## 4. Mejores Prácticas OWASP Aplicadas

### A01: Broken Access Control

**Implementado**:
- ✅ Guards basados en roles (`RolesGuard`, `AdminGuard`, `RestaurantOwnerGuard`)
- ✅ Decoradores `@Roles()` para control de acceso
- ✅ Decorador `@Public()` para endpoints públicos
- ✅ Verificación de permisos en servicios (usuario solo puede acceder a sus propios recursos)

**Archivos relacionados**:
- `src/common/guards/roles.guard.ts`
- `src/common/guards/admin.guard.ts`
- `src/common/guards/restaurant-owner.guard.ts`
- `src/common/decorators/roles.decorator.ts`

---

### A02: Cryptographic Failures

**Implementado**:
- ✅ Passwords hasheados con bcrypt (10 rounds)
- ✅ JWT tokens con secrets seguros (mínimo 32 caracteres)
- ✅ Variables de entorno validadas al inicio
- ✅ No se almacenan passwords en texto plano
- ✅ No se transmiten passwords en logs

**Archivos relacionados**:
- `src/auth/auth.service.ts`
- `src/users/entities/user.entity.ts`
- `src/config/env.validation.ts`

---

### A03: Injection

**Implementado**:
- ✅ TypeORM usa parámetros preparados (previene SQL injection)
- ✅ Sanitización de inputs con `SanitizePipe` (previene XSS, SQL injection, NoSQL injection)
- ✅ Validación estricta con `class-validator`
- ✅ No se usan queries SQL crudas con concatenación

**Archivos relacionados**:
- `src/common/pipes/sanitize.pipe.ts`
- `src/main.ts` (ValidationPipe)
- Todos los DTOs con validaciones

---

### A04: Insecure Design

**Implementado**:
- ✅ Arquitectura modular de NestJS
- ✅ Separación de responsabilidades
- ✅ Validación en múltiples capas
- ✅ Principio de menor privilegio en permisos

---

### A05: Security Misconfiguration

**Implementado**:
- ✅ Headers de seguridad con Helmet
- ✅ CORS configurado por entorno
- ✅ Variables de entorno validadas
- ✅ Mensajes de error seguros en producción
- ✅ Configuración segura de Swagger (solo en desarrollo si es necesario)

**Archivos relacionados**:
- `src/main.ts`
- `src/config/helmet.config.ts`
- `src/config/cors.config.ts`
- `src/config/env.validation.ts`

---

### A06: Vulnerable and Outdated Components

**Implementado**:
- ✅ Dependencias actualizadas regularmente
- ✅ `npm audit` ejecutado periódicamente
- ✅ Versiones específicas en `package-lock.json`

**Proceso**:
```bash
# Revisar vulnerabilidades
npm audit

# Actualizar dependencias de seguridad
npm audit fix

# Revisar actualizaciones
npm outdated
```

---

### A07: Identification and Authentication Failures

**Implementado**:
- ✅ JWT con expiración corta (1 hora access, 7 días refresh)
- ✅ Refresh token con rotación
- ✅ Verificación de email obligatoria
- ✅ Rate limiting en endpoints de autenticación
- ✅ Protección contra timing attacks en comparación de passwords
- ✅ Passwords con validación de fortaleza

**Archivos relacionados**:
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- `src/common/guards/throttler.guard.ts`

---

### A08: Software and Data Integrity Failures

**Implementado**:
- ✅ Validación de variables de entorno al inicio
- ✅ Verificación de firma en webhooks de Wompi
- ✅ Validación de integridad de datos

**Archivos relacionados**:
- `src/config/env.validation.ts`
- `src/payments/providers/wompi.client.ts`

---

### A09: Security Logging and Monitoring Failures

**Implementado**:
- ✅ Logging estructurado con Winston
- ✅ Sanitización de logs antes de escribir
- ✅ Logging de eventos de seguridad (login, registro, cambios de estado)
- ✅ Logging de intentos fallidos

**Archivos relacionados**:
- `src/common/interceptors/logging.interceptor.ts`
- `src/common/utils/log-sanitizer.util.ts`
- `src/config/logger.config.ts`

---

### A10: Server-Side Request Forgery (SSRF)

**Implementado**:
- ✅ Validación de URLs en variables de entorno
- ✅ No se hacen requests a URLs dinámicas desde inputs de usuario
- ✅ URLs de APIs externas (Wompi, Siigo) vienen de configuración, no de inputs

**Archivos relacionados**:
- `src/config/env.validation.ts`
- `src/payments/providers/wompi.client.ts`

---

## 5. Proceso de Rotación Sin Downtime

### 5.1 Wompi Keys - Ejemplo Paso a Paso

**Paso 1: Preparar nuevas keys**
```bash
# 1. Acceder al dashboard de Wompi
# 2. Generar nuevas keys en la sección de API Keys
# 3. Copiar nuevas keys (no revocar las antiguas aún)
```

**Paso 2: Actualizar entorno de staging**
```bash
# En staging server:
# Actualizar .env con nuevas keys
WOMPI_PUBLIC_KEY=nueva_public_key
WOMPI_PRIVATE_KEY=nueva_private_key
WOMPI_INTEGRITY_SECRET=nuevo_secret
```

**Paso 3: Verificar en staging**
- Probar creación de tarjeta
- Probar procesamiento de pago
- Verificar webhooks

**Paso 4: Actualizar producción**
```bash
# En producción server:
# 1. Hacer backup del .env actual
# 2. Actualizar .env con nuevas keys
# 3. Reiniciar aplicación
```

**Paso 5: Monitoreo**
- Monitorear logs por 24 horas
- Verificar que no haya errores de autenticación
- Verificar que los pagos se procesen correctamente

**Paso 6: Limpieza**
- Después de 48 horas sin problemas, revocar keys antiguas en Wompi
- Eliminar referencias a keys antiguas si hay

---

### 5.2 Siigo Keys - Ejemplo Paso a Paso

**Paso 1: Generar nuevas credenciales**
```bash
# 1. Acceder al dashboard de Siigo
# 2. Generar nuevo Access Key
# 3. Obtener nuevas credenciales completas
```

**Paso 2: Actualizar staging**
```bash
SIIGO_USERNAME=nuevo_usuario
SIIGO_ACCESS_KEY=nueva_key
```

**Paso 3: Verificar en staging**
- Probar autenticación con Siigo
- Probar creación de factura de prueba

**Paso 4: Actualizar producción**
- Actualizar variables de entorno
- Reiniciar aplicación

**Paso 5: Monitoreo**
- Verificar que las facturas se creen correctamente
- Monitorear logs por 24 horas

---

### 5.3 JWT Secrets - Ejemplo Paso a Paso

**⚠️ Nota**: La rotación de JWT secrets requiere planificación especial.

**Opción Recomendada: Rotación Gradual**

**Paso 1: Preparar nuevos secrets**
```bash
# Generar nuevos secrets seguros (32+ caracteres)
JWT_SECRET_NEW=$(openssl rand -base64 32)
JWT_REFRESH_SECRET_NEW=$(openssl rand -base64 32)
```

**Paso 2: Modificar código para soportar ambos secrets**
```typescript
// En jwt.strategy.ts y auth.service.ts
// Verificar tokens con ambos secrets
// Generar tokens solo con el nuevo secret
```

**Paso 3: Desplegar**
- Deploy con soporte dual
- Monitorear durante período de gracia

**Paso 4: Limpieza**
- Después de que todos los tokens antiguos expiren, remover soporte para secret antiguo

---

## 6. Troubleshooting de Seguridad

### Problema: API Key expuesta en logs

**Síntomas**:
- Logs contienen API keys completas
- Advertencias en auditoría

**Solución**:
1. Verificar que `sanitizeForLogging` se use en todos los logs
2. Revisar todos los archivos que usan `logger` o `winstonLogger`
3. Usar `sanitizeForLogging()` antes de loguear objetos
4. Rotar la key expuesta inmediatamente

---

### Problema: Rate limiting no funciona

**Síntomas**:
- Usuarios pueden hacer más requests de los permitidos
- No se reciben respuestas 429

**Solución**:
1. Verificar que `CustomThrottlerGuard` esté registrado como `APP_GUARD`
2. Verificar que Redis esté corriendo y accesible
3. Verificar configuración en `throttler.config.ts`
4. Revisar logs para errores de Redis

---

### Problema: Headers de seguridad no están presentes

**Síntomas**:
- Respuestas HTTP no incluyen headers de Helmet
- Advertencias en herramientas de seguridad

**Solución**:
1. Verificar que `helmet(getHelmetConfig())` esté en `main.ts`
2. Verificar que Helmet esté antes de otros middlewares
3. Verificar que no haya errores al iniciar el servidor

---

### Problema: Campos sensibles expuestos en respuestas

**Síntomas**:
- Respuestas JSON contienen passwords o tokens
- Información sensible visible en Swagger

**Solución**:
1. Verificar que `ClassSerializerInterceptor` esté aplicado globalmente
2. Verificar que DTOs tengan `@Exclude()` en campos sensibles
3. Verificar que entidades tengan `@Exclude()` en campos sensibles
4. Usar `@Expose()` explícitamente si es necesario

---

### Problema: Sanitización no funciona

**Síntomas**:
- Inputs con XSS o SQL injection no se limpian
- Caracteres peligrosos pasan la validación

**Solución**:
1. Verificar que `SanitizePipe` esté antes de `ValidationPipe` en `main.ts`
2. Verificar que `SanitizePipe` esté en `useGlobalPipes`
3. Revisar logs para errores en sanitización
4. Verificar que DOMPurify y jsdom estén instalados

---

## 7. Manejo de Incidentes

### 7.1 Exposición de API Key

**Procedimiento**:

1. **Inmediato (primeros 5 minutos)**:
   - Identificar qué key fue expuesta
   - Revocar la key en el dashboard correspondiente (Wompi/Siigo)
   - Generar nueva key
   - Actualizar variables de entorno

2. **Corto plazo (primeras 24 horas)**:
   - Investigar cómo se expuso (logs, código, repositorio)
   - Corregir el problema que causó la exposición
   - Monitorear actividad sospechosa
   - Revisar logs por uso no autorizado

3. **Largo plazo**:
   - Implementar medidas preventivas
   - Actualizar documentación
   - Capacitar al equipo

---

### 7.2 Compromiso de Password

**Procedimiento**:

1. **Inmediato**:
   - Invalidar todos los tokens del usuario afectado
   - Forzar cambio de password
   - Verificar actividad sospechosa en la cuenta

2. **Corto plazo**:
   - Revisar logs de acceso del usuario
   - Verificar si hubo acceso no autorizado
   - Notificar al usuario

3. **Largo plazo**:
   - Revisar medidas de seguridad
   - Implementar mejoras si es necesario

---

### 7.3 Ataque Detectado

**Procedimiento**:

1. **Identificación**:
   - Revisar logs de seguridad
   - Identificar tipo de ataque
   - Identificar origen (IP, usuario)

2. **Contención**:
   - Bloquear IPs sospechosas (si aplica)
   - Aumentar rate limiting temporalmente
   - Deshabilitar endpoints afectados si es necesario

3. **Mitigación**:
   - Aplicar parches si es necesario
   - Implementar medidas adicionales
   - Monitorear actividad

4. **Recuperación**:
   - Restaurar funcionalidad normal
   - Monitorear por 48 horas
   - Documentar incidente

---

## 8. Contactos de Emergencia

**Para incidentes de seguridad críticos**:
1. Equipo de desarrollo: [CONTACTO]
2. Administrador de sistemas: [CONTACTO]
3. Soporte de Wompi: https://docs.wompi.co
4. Soporte de Siigo: https://siigo.com

---

## 9. Recursos Adicionales

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Documentación de NestJS Security](https://docs.nestjs.com/security/security)
- [Helmet Documentation](https://helmetjs.github.io/)
- [Wompi Security Guide](https://docs.wompi.co/security)

---

**Última actualización**: 2025-01-XX  
**Versión**: 1.0.0  
**Autor**: Equipo de Desarrollo UniFoodApp

