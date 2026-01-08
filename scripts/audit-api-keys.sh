#!/bin/bash

# Script de Auditoría de API Keys y Variables de Entorno
# Detecta API keys hardcodeadas y lista variables de entorno necesarias

set -e

echo "=========================================="
echo "🔍 Auditoría de API Keys y Variables de Entorno"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "📁 Directorio del proyecto: $PROJECT_DIR"
echo ""

# Contador de problemas encontrados
ISSUES=0
WARNINGS=0

# ============================================
# 1. Buscar API Keys hardcodeadas
# ============================================
echo "1️⃣ Buscando API Keys hardcodeadas en el código..."
echo "----------------------------------------"

# Patrones a buscar
PATTERNS=(
  "WOMPI_PUBLIC_KEY.*=.*['\"][^'\"]{20,}"
  "WOMPI_PRIVATE_KEY.*=.*['\"][^'\"]{20,}"
  "WOMPI_INTEGRITY_SECRET.*=.*['\"][^'\"]{20,}"
  "SIIGO_ACCESS_KEY.*=.*['\"][^'\"]{20,}"
  "SIIGO_USERNAME.*=.*['\"][^'\"]{10,}"
  "JWT_SECRET.*=.*['\"][^'\"]{20,}"
  "api[_-]?key.*=.*['\"][^'\"]{20,}"
  "secret.*=.*['\"][^'\"]{20,}"
  "token.*=.*['\"][^'\"]{30,}"
)

HARDCODED_FOUND=false

for pattern in "${PATTERNS[@]}"; do
  # Buscar en archivos .ts, .js (excluyendo node_modules, dist, .git)
  results=$(grep -r -E "$pattern" \
    --include="*.ts" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.git \
    "$PROJECT_DIR/src" 2>/dev/null || true)
  
  if [ -n "$results" ]; then
    echo -e "${RED}❌ Posible API key hardcodeada encontrada:${NC}"
    echo "$results" | while IFS= read -r line; do
      echo "   $line"
    done
    HARDCODED_FOUND=true
    ((ISSUES++))
  fi
done

if [ "$HARDCODED_FOUND" = false ]; then
  echo -e "${GREEN}✅ No se encontraron API keys hardcodeadas${NC}"
fi

echo ""

# ============================================
# 2. Verificar uso de ConfigService
# ============================================
echo "2️⃣ Verificando uso de ConfigService para APIs externas..."
echo "----------------------------------------"

# Archivos que deberían usar ConfigService
FILES_TO_CHECK=(
  "src/payments/providers/wompi.client.ts"
  "src/invoices/siigo/siigo-api.client.ts"
  "src/invoices/invoice.service.ts"
)

ALL_USE_CONFIG=true

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    if grep -q "ConfigService" "$file"; then
      echo -e "${GREEN}✅ $file usa ConfigService${NC}"
    else
      echo -e "${YELLOW}⚠️  $file podría no estar usando ConfigService${NC}"
      ALL_USE_CONFIG=false
      ((WARNINGS++))
    fi
  fi
done

if [ "$ALL_USE_CONFIG" = true ]; then
  echo -e "${GREEN}✅ Todos los archivos críticos usan ConfigService${NC}"
fi

echo ""

# ============================================
# 3. Listar variables de entorno encontradas
# ============================================
echo "3️⃣ Variables de entorno encontradas en el código..."
echo "----------------------------------------"

# Buscar todas las referencias a process.env y configService.get
ENV_VARS=$(grep -r -h \
  --include="*.ts" \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.git \
  -E "(process\.env\.|configService\.get\(|ConfigService\.get\()" \
  "$PROJECT_DIR/src" 2>/dev/null | \
  grep -oE "(process\.env\.|configService\.get\(|ConfigService\.get\()['\"][A-Z_][A-Z0-9_]*['\"]" | \
  sed -E "s/(process\.env\.|configService\.get\(|ConfigService\.get\()['\"]//g" | \
  sed "s/['\"]//g" | \
  sort -u)

if [ -n "$ENV_VARS" ]; then
  echo "Variables encontradas:"
  echo "$ENV_VARS" | while IFS= read -r var; do
    echo "  - $var"
  done
else
  echo -e "${YELLOW}⚠️  No se encontraron variables de entorno${NC}"
fi

echo ""

# ============================================
# 4. Verificar existencia de .env.example
# ============================================
echo "4️⃣ Verificando documentación de variables de entorno..."
echo "----------------------------------------"

if [ -f ".env.example" ]; then
  echo -e "${GREEN}✅ Archivo .env.example existe${NC}"
  ENV_EXAMPLE_COUNT=$(grep -c "^[A-Z_]" .env.example 2>/dev/null || echo "0")
  echo "   Variables documentadas: $ENV_EXAMPLE_COUNT"
else
  echo -e "${YELLOW}⚠️  Archivo .env.example no existe${NC}"
  echo "   Se recomienda crear este archivo para documentar variables de entorno"
  ((WARNINGS++))
fi

echo ""

# ============================================
# 5. Verificar .env en .gitignore
# ============================================
echo "5️⃣ Verificando que .env esté en .gitignore..."
echo "----------------------------------------"

if [ -f ".gitignore" ]; then
  if grep -q "^\.env$" .gitignore || grep -q "\.env" .gitignore; then
    echo -e "${GREEN}✅ .env está en .gitignore${NC}"
  else
    echo -e "${RED}❌ .env NO está en .gitignore${NC}"
    echo "   ⚠️  CRÍTICO: Agregar .env a .gitignore para evitar commitear secrets"
    ((ISSUES++))
  fi
else
  echo -e "${YELLOW}⚠️  Archivo .gitignore no encontrado${NC}"
  ((WARNINGS++))
fi

echo ""

# ============================================
# Resumen
# ============================================
echo "=========================================="
echo "📊 Resumen de Auditoría"
echo "=========================================="

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ Auditoría completada sin problemas${NC}"
  exit 0
elif [ $ISSUES -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Auditoría completada con $WARNINGS advertencia(s)${NC}"
  exit 0
else
  echo -e "${RED}❌ Auditoría completada con $ISSUES problema(s) y $WARNINGS advertencia(s)${NC}"
  echo ""
  echo "Recomendaciones:"
  echo "  1. Mover todas las API keys a variables de entorno"
  echo "  2. Usar ConfigService para acceder a variables de entorno"
  echo "  3. Crear archivo .env.example documentado"
  echo "  4. Asegurar que .env esté en .gitignore"
  exit 1
fi

