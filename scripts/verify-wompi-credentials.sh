#!/bin/bash

# Script de Verificación de Credenciales Wompi Sandbox
# Valida que las credenciales de Wompi estén configuradas correctamente
# y que la conexión con el API de Wompi funcione

set -e

echo "=========================================="
echo "🔐 Verificación de Credenciales Wompi"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Cargar variables de entorno desde .env si existe
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "📁 Directorio del proyecto: $PROJECT_DIR"
echo ""

# Variables requeridas
WOMPI_API_URL="${WOMPI_API_URL:-https://sandbox.wompi.co}"
WOMPI_PUBLIC_KEY="${WOMPI_PUBLIC_KEY:-}"
WOMPI_PRIVATE_KEY="${WOMPI_PRIVATE_KEY:-}"
WOMPI_INTEGRITY_SECRET="${WOMPI_INTEGRITY_SECRET:-}"

ISSUES=0
WARNINGS=0

check_passed() {
  echo -e "${GREEN}✅ $1${NC}"
}

check_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  ((WARNINGS++))
}

check_failed() {
  echo -e "${RED}❌ $1${NC}"
  ((ISSUES++))
}

# ============================================
# 1. Verificar variables de entorno
# ============================================
echo "1️⃣ Verificando variables de entorno..."
echo "----------------------------------------"

if [ -z "$WOMPI_API_URL" ]; then
  check_failed "WOMPI_API_URL no está configurada"
else
  if [[ "$WOMPI_API_URL" == *"sandbox"* ]]; then
    check_passed "WOMPI_API_URL configurada: $WOMPI_API_URL (Sandbox)"
  else
    check_warning "WOMPI_API_URL configurada: $WOMPI_API_URL (verificar que sea sandbox para testing)"
  fi
fi

if [ -z "$WOMPI_PUBLIC_KEY" ]; then
  check_failed "WOMPI_PUBLIC_KEY no está configurada"
else
  if [[ "$WOMPI_PUBLIC_KEY" == pub_test_* ]]; then
    check_passed "WOMPI_PUBLIC_KEY configurada (prefijo pub_test_ correcto)"
  else
    check_warning "WOMPI_PUBLIC_KEY configurada pero no tiene prefijo pub_test_ (¿es sandbox?)"
  fi
fi

if [ -z "$WOMPI_PRIVATE_KEY" ]; then
  check_failed "WOMPI_PRIVATE_KEY no está configurada"
else
  if [[ "$WOMPI_PRIVATE_KEY" == prv_test_* ]]; then
    check_passed "WOMPI_PRIVATE_KEY configurada (prefijo prv_test_ correcto)"
  else
    check_warning "WOMPI_PRIVATE_KEY configurada pero no tiene prefijo prv_test_ (¿es sandbox?)"
  fi
fi

if [ -z "$WOMPI_INTEGRITY_SECRET" ]; then
  check_warning "WOMPI_INTEGRITY_SECRET no está configurada (requerida para webhooks)"
else
  if [[ "$WOMPI_INTEGRITY_SECRET" == test_integrity_* ]] || [[ "$WOMPI_INTEGRITY_SECRET" == *"test"* ]]; then
    check_passed "WOMPI_INTEGRITY_SECRET configurada (parece ser de sandbox)"
  else
    check_warning "WOMPI_INTEGRITY_SECRET configurada (verificar que sea de sandbox)"
  fi
fi

echo ""

# ============================================
# 2. Verificar conexión con API de Wompi
# ============================================
echo "2️⃣ Verificando conexión con API de Wompi..."
echo "----------------------------------------"

if [ -z "$WOMPI_PRIVATE_KEY" ]; then
  check_failed "No se puede verificar conexión: WOMPI_PRIVATE_KEY no está configurada"
  echo ""
  echo "=========================================="
  echo "📊 Resumen de Verificación"
  echo "=========================================="
  echo ""
  echo -e "❌ Fallidos: ${RED}${ISSUES}${NC}"
  echo -e "⚠️  Advertencias: ${YELLOW}${WARNINGS}${NC}"
  echo ""
  exit 1
fi

# Intentar hacer una llamada simple a Wompi API para verificar credenciales
# Usamos curl para consultar una transacción que no existe (debería fallar con 404 pero validar credenciales)
# O mejor, intentamos consultar información del merchant (si existe endpoint)
# Como alternativa, intentamos consultar una transacción inválida - si las credenciales son incorrectas, dará 401/403

TEST_TRANSACTION_ID="test_connection_$(date +%s)"

if command -v curl &> /dev/null; then
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $WOMPI_PRIVATE_KEY" \
    "${WOMPI_API_URL}/v1/transactions/${TEST_TRANSACTION_ID}" 2>&1)
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" -eq 401 ] || [ "$HTTP_CODE" -eq 403 ]; then
    check_failed "Credenciales inválidas (HTTP $HTTP_CODE). Verifica WOMPI_PRIVATE_KEY"
  elif [ "$HTTP_CODE" -eq 404 ]; then
    check_passed "Conexión exitosa con Wompi API (transacción no encontrada, pero credenciales válidas)"
  elif [ "$HTTP_CODE" -eq 200 ]; then
    check_passed "Conexión exitosa con Wompi API"
  else
    check_warning "Respuesta inesperada de Wompi API (HTTP $HTTP_CODE). Verifica manualmente"
    echo "  Respuesta: $BODY"
  fi
else
  check_warning "curl no está instalado. No se puede verificar conexión automáticamente"
  echo "  Instala curl o verifica manualmente con:"
  echo "  curl -X GET -H \"Authorization: Bearer \$WOMPI_PRIVATE_KEY\" ${WOMPI_API_URL}/v1/transactions/test_id"
fi

echo ""

# ============================================
# 3. Resumen
# ============================================
echo "=========================================="
echo "📊 Resumen de Verificación"
echo "=========================================="
echo ""

if [ "$ISSUES" -gt 0 ]; then
  echo -e "${RED}❌ Verificación falló${NC}"
  echo ""
  echo "Hay $ISSUES problema(s) que deben ser corregidos:"
  echo "1. Configura las variables de entorno faltantes en .env"
  echo "2. Verifica que las credenciales sean de Sandbox (prefijos pub_test_, prv_test_)"
  echo "3. Asegúrate de usar WOMPI_API_URL=https://sandbox.wompi.co para testing"
  echo ""
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Verificación completada con advertencias${NC}"
  echo ""
  echo "Hay $WARNINGS advertencia(s). Revisa:"
  echo "- Prefijos de las keys (deben ser pub_test_ y prv_test_ para sandbox)"
  echo "- WOMPI_API_URL debe apuntar a sandbox para testing"
  echo ""
  exit 0
else
  echo -e "${GREEN}✅ Todas las verificaciones pasaron correctamente${NC}"
  echo ""
  echo "Las credenciales de Wompi Sandbox están configuradas correctamente."
  echo "Puedes proceder con el testing de integraciones."
  echo ""
  exit 0
fi
