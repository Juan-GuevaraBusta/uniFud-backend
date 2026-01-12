#!/bin/bash

# Script de Verificación Automatizada de Seguridad
# Verifica que las medidas de seguridad están correctamente implementadas

set -e

echo "=========================================="
echo "🔒 Verificación Automatizada de Seguridad"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de problemas
ISSUES=0
WARNINGS=0
CHECKS_PASSED=0
TOTAL_CHECKS=0

# Directorio del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "📁 Directorio del proyecto: $PROJECT_DIR"
echo ""

# Función para marcar check como pasado
check_passed() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  echo -e "${GREEN}✅${NC} $1"
}

# Función para marcar check como fallido
check_failed() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  ISSUES=$((ISSUES + 1))
  echo -e "${RED}❌${NC} $1"
}

# Función para marcar advertencia
check_warning() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  WARNINGS=$((WARNINGS + 1))
  echo -e "${YELLOW}⚠️${NC} $1"
}

# ============================================
# 1. Verificar Rate Limiting
# ============================================
echo "1️⃣ Verificando Rate Limiting..."
echo "----------------------------------------"

# 1.1 CustomThrottlerGuard en AppModule
if grep -q "CustomThrottlerGuard" src/app.module.ts && grep -q "APP_GUARD" src/app.module.ts; then
  check_passed "CustomThrottlerGuard aplicado globalmente en AppModule"
else
  check_failed "CustomThrottlerGuard NO está aplicado globalmente en AppModule"
fi

# 1.2 Decoradores @Throttle en auth controller
if grep -q "@Throttle" src/auth/auth.controller.ts; then
  check_passed "Decoradores @Throttle presentes en auth.controller.ts"
else
  check_failed "Decoradores @Throttle NO encontrados en auth.controller.ts"
fi

# 1.3 Decorador @Throttle en payments controller (webhooks)
if grep -q "@Throttle" src/payments/payments.controller.ts; then
  check_passed "Decorador @Throttle presente en payments.controller.ts (webhooks)"
else
  check_failed "Decorador @Throttle NO encontrado en payments.controller.ts"
fi

# 1.4 Manejo de ThrottlerException
if grep -q "ThrottlerException" src/common/filters/all-exceptions.filter.ts; then
  check_passed "ThrottlerException manejado en all-exceptions.filter.ts"
else
  check_failed "ThrottlerException NO está manejado en all-exceptions.filter.ts"
fi

echo ""

# ============================================
# 2. Verificar Validación y Sanitización
# ============================================
echo "2️⃣ Verificando Validación y Sanitización..."
echo "----------------------------------------"

# 2.1 SanitizePipe en main.ts
if grep -q "SanitizePipe" src/main.ts; then
  check_passed "SanitizePipe aplicado globalmente en main.ts"
else
  check_failed "SanitizePipe NO está aplicado en main.ts"
fi

# 2.2 ValidationPipe con whitelist y forbidNonWhitelisted
if grep -q "whitelist.*true" src/main.ts && grep -q "forbidNonWhitelisted.*true" src/main.ts; then
  check_passed "ValidationPipe configurado con whitelist y forbidNonWhitelisted"
else
  check_failed "ValidationPipe NO está configurado correctamente (whitelist/forbidNonWhitelisted)"
fi

# 2.3 SanitizePipe implementación
if [ -f "src/common/pipes/sanitize.pipe.ts" ]; then
  check_passed "SanitizePipe existe"
  if grep -q "DOMPurify\|sqlInjectionPatterns\|nosqlInjectionPatterns" src/common/pipes/sanitize.pipe.ts; then
    check_passed "SanitizePipe implementa sanitización (DOMPurify, SQL/NoSQL patterns)"
  else
    check_warning "SanitizePipe puede no tener todas las sanitizaciones implementadas"
  fi
else
  check_failed "SanitizePipe NO existe"
fi

echo ""

# ============================================
# 3. Verificar API Keys y Variables de Entorno
# ============================================
echo "3️⃣ Verificando API Keys y Variables de Entorno..."
echo "----------------------------------------"

# 3.1 Ejecutar script de auditoría
if [ -f "scripts/audit-api-keys.sh" ]; then
  echo "  Ejecutando script de auditoría de API keys..."
  if bash scripts/audit-api-keys.sh 2>&1 | grep -q "✅ No se encontraron API keys hardcodeadas\|0 problemas encontrados"; then
    check_passed "No se encontraron API keys hardcodeadas"
  else
    check_warning "El script de auditoría encontró posibles keys hardcodeadas (revisar manualmente)"
  fi
else
  check_failed "Script de auditoría (audit-api-keys.sh) NO existe"
fi

# 3.2 Uso de ConfigService en WompiClient
if grep -q "ConfigService" src/payments/providers/wompi.client.ts; then
  check_passed "WompiClient usa ConfigService (no keys hardcodeadas)"
else
  check_warning "WompiClient puede no estar usando ConfigService"
fi

# 3.3 Validación de variables de entorno
if grep -q "export function validate" src/config/env.validation.ts; then
  check_passed "Función validate existe en env.validation.ts"
else
  check_failed "Función validate NO existe en env.validation.ts"
fi

if grep "validate" src/app.module.ts | grep -v "^[[:space:]]*//" | grep -q "validate"; then
  check_passed "ConfigModule usa función validate en app.module.ts"
else
  check_failed "ConfigModule NO está usando función validate"
fi

# 3.4 .env.example
if [ -f ".env.example" ]; then
  check_passed ".env.example existe"
  # Verificar que no contiene valores reales (búsqueda básica)
  if grep -q "WOMPI_PUBLIC_KEY=" .env.example && grep -q "your_\|example\|placeholder" .env.example 2>/dev/null; then
    check_passed ".env.example parece contener solo ejemplos (revisar manualmente para seguridad)"
  else
    check_warning ".env.example existe pero puede contener valores reales (revisar manualmente)"
  fi
else
  check_failed ".env.example NO existe"
fi

echo ""

# ============================================
# 4. Verificar Tests de Seguridad
# ============================================
echo "4️⃣ Verificando Tests de Seguridad..."
echo "----------------------------------------"

# 4.1 Verificar que los archivos de test existen
if [ -f "test/security/rate-limiting.e2e-spec.ts" ]; then
  check_passed "test/security/rate-limiting.e2e-spec.ts existe"
else
  check_failed "test/security/rate-limiting.e2e-spec.ts NO existe"
fi

if [ -f "test/security/validation.e2e-spec.ts" ]; then
  check_passed "test/security/validation.e2e-spec.ts existe"
else
  check_failed "test/security/validation.e2e-spec.ts NO existe"
fi

if [ -f "test/security/api-keys.e2e-spec.ts" ]; then
  check_passed "test/security/api-keys.e2e-spec.ts existe"
else
  check_failed "test/security/api-keys.e2e-spec.ts NO existe"
fi

# Nota: No ejecutamos los tests aquí porque pueden requerir DB/Redis activos
# Se recomienda ejecutarlos manualmente: npm run test:e2e -- <test-file>

echo ""

# ============================================
# 5. Verificar Documentación SECURITY.md
# ============================================
echo "5️⃣ Verificando Documentación SECURITY.md..."
echo "----------------------------------------"

if [ -f "docs/SECURITY.md" ]; then
  check_passed "docs/SECURITY.md existe"
  
  # Verificar secciones principales
  if grep -qE "^##.*[Rr]otación|##.*Rotación" docs/SECURITY.md; then
    check_passed "SECURITY.md contiene sección de rotación de API keys"
  else
    check_warning "SECURITY.md puede no contener sección de rotación"
  fi
  
  if grep -qE "^##.*[Cc]hecklist|##.*Checklist" docs/SECURITY.md; then
    check_passed "SECURITY.md contiene checklist"
  else
    check_warning "SECURITY.md puede no contener checklist"
  fi
  
  if grep -qE "OWASP" docs/SECURITY.md; then
    check_passed "SECURITY.md menciona OWASP"
  else
    check_warning "SECURITY.md puede no mencionar OWASP"
  fi
else
  check_failed "docs/SECURITY.md NO existe"
fi

echo ""

# ============================================
# 6. Verificar Headers de Seguridad
# ============================================
echo "6️⃣ Verificando Headers de Seguridad..."
echo "----------------------------------------"

# 6.1 Helmet en main.ts
if grep -q "helmet" src/main.ts; then
  check_passed "Helmet configurado en main.ts"
else
  check_failed "Helmet NO está configurado en main.ts"
fi

# 6.2 Configuración de Helmet
if [ -f "src/config/helmet.config.ts" ]; then
  check_passed "helmet.config.ts existe"
  
  if grep -q "contentSecurityPolicy\|xContentTypeOptions\|xFrameOptions\|xXssProtection" src/config/helmet.config.ts; then
    check_passed "helmet.config.ts contiene configuración de headers"
  else
    check_warning "helmet.config.ts puede no tener toda la configuración"
  fi
else
  check_failed "src/config/helmet.config.ts NO existe"
fi

echo ""

# ============================================
# 7. Verificar Logging de Eventos de Seguridad
# ============================================
echo "7️⃣ Verificando Logging de Eventos de Seguridad..."
echo "----------------------------------------"

# 7.1 LoggingInterceptor en main.ts
if grep -q "LoggingInterceptor" src/main.ts; then
  check_passed "LoggingInterceptor registrado globalmente en main.ts"
else
  check_failed "LoggingInterceptor NO está registrado globalmente"
fi

# 7.2 Detección de eventos de seguridad
if [ -f "src/common/interceptors/logging.interceptor.ts" ]; then
  check_passed "logging.interceptor.ts existe"
  
  if grep -qE "securityEvent|rate_limit|validation_failed" src/common/interceptors/logging.interceptor.ts; then
    check_passed "LoggingInterceptor detecta eventos de seguridad"
  else
    check_warning "LoggingInterceptor puede no detectar eventos de seguridad"
  fi
else
  check_failed "src/common/interceptors/logging.interceptor.ts NO existe"
fi

echo ""

# ============================================
# Resumen
# ============================================
echo "=========================================="
echo "📊 Resumen de Verificación"
echo "=========================================="
echo ""
echo -e "Total de checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "✅ Pasados: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "⚠️  Advertencias: ${YELLOW}$WARNINGS${NC}"
echo -e "❌ Fallidos: ${RED}$ISSUES${NC}"
echo ""

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ Todas las verificaciones pasaron correctamente${NC}"
  echo ""
  echo "Próximos pasos:"
  echo "1. Ejecutar tests de seguridad: npm run test:e2e"
  echo "2. Revisar checklist completo: docs/SECURITY_CHECKLIST.md"
  echo "3. Realizar testing manual según la guía"
  exit 0
elif [ $ISSUES -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Verificación completada con advertencias${NC}"
  echo ""
  echo "Revisar las advertencias arriba y corregir según sea necesario."
  exit 0
else
  echo -e "${RED}❌ Verificación falló${NC}"
  echo ""
  echo "Hay $ISSUES problema(s) que deben ser corregidos antes de continuar."
  exit 1
fi
