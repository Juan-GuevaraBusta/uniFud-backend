# Guía de Load Testing - UniFoodApp

## Descripción

Este documento describe cómo ejecutar pruebas de carga con Artillery para evaluar el rendimiento de la API.

## Instalación

Artillery ya está instalado como dependencia de desarrollo:

```bash
npm install --save-dev artillery
```

## Configuración

### Variables de Entorno (Opcional)

Para pruebas con endpoints autenticados, configura estas variables en `.env`:

```env
TEST_UNIVERSITY_ID=uuid-de-universidad-existente
TEST_RESTAURANT_ID=uuid-de-restaurante-existente
TEST_DISH_ID=uuid-de-plato-existente
TEST_USER_EMAIL=usuario@example.com
TEST_USER_PASSWORD=password123
```

## Ejecutar Load Tests

### Prueba Básica (Endpoints Públicos)

```bash
npx artillery run test/load-test.yml
```

### Prueba con Output Detallado

```bash
npx artillery run test/load-test.yml --output report.json
npx artillery report report.json
```

### Prueba contra Staging/Producción

```bash
# Modificar target en load-test.yml o usar variable de entorno
TARGET_URL=https://api-staging.unifoodapp.com npx artillery run test/load-test.yml
```

## Escenarios de Prueba

El archivo `load-test.yml` incluye los siguientes escenarios:

### 1. Consultar Universidades (30% del tráfico)
- Endpoint: `GET /universities`
- Peso: 30%
- Endpoint público, muy usado

### 2. Consultar Restaurantes (25% del tráfico)
- Endpoint: `GET /restaurants?universityId=...`
- Peso: 25%
- Endpoint público con filtro

### 3. Consultar Menú (20% del tráfico)
- Endpoint: `GET /dishes/menu/:restaurantId`
- Peso: 20%
- Endpoint público con caché

### 4. Consultar Platos (15% del tráfico)
- Endpoint: `GET /dishes?limit=20&page=1`
- Peso: 15%
- Endpoint público con paginación

## Fases de Carga

### Fase 1: Warm-up (30 segundos)
- 2 usuarios por segundo
- Preparar el sistema y caché

### Fase 2: Carga Normal (2 minutos)
- 25 usuarios por segundo (50 usuarios simultáneos)
- Simula uso normal de la aplicación

### Fase 3: Pico de Carga (1 minuto)
- 50 usuarios por segundo (100 usuarios simultáneos)
- Simula momentos de alta demanda

## Métricas Esperadas

### Tiempos de Respuesta

| Endpoint | p50 (ms) | p95 (ms) | p99 (ms) |
|----------|----------|----------|----------|
| GET /universities | < 50 | < 100 | < 200 |
| GET /restaurants | < 100 | < 200 | < 300 |
| GET /dishes/menu/:id | < 50 | < 100 | < 200 |
| GET /dishes | < 100 | < 200 | < 300 |

### Rate de Errores

- **Objetivo**: < 1%
- **Aceptable**: < 5%
- **Crítico**: > 5%

### Throughput

- Requests por segundo: > 100 req/s
- Requests exitosos: > 95%

## Interpretar Resultados

### Reporte de Artillery

Artillery genera un reporte con:
- **Summary**: Resumen general de la prueba
- **Scenarios**: Estadísticas por escenario
- **Codes**: Códigos de estado HTTP
- **Latency**: Tiempos de respuesta (p50, p95, p99)
- **Errors**: Errores encontrados

### Indicadores de Problemas

1. **Tiempos de respuesta altos (p95 > 500ms)**
   - Revisar queries de base de datos
   - Verificar que el caché esté funcionando
   - Revisar índices de base de datos

2. **Rate de errores alto (> 5%)**
   - Revisar logs del servidor
   - Verificar que no haya memory leaks
   - Revisar límites de conexiones de BD

3. **Throughput bajo (< 50 req/s)**
   - Verificar recursos del servidor (CPU, memoria)
   - Revisar configuración de conexiones
   - Optimizar código crítico

## Mejores Prácticas

1. **Ejecutar en ambiente similar a producción**
   - Misma configuración de recursos
   - Misma base de datos (datos de prueba similares)
   - Mismo caché (Redis si aplica)

2. **Empezar con carga baja**
   - Aumentar gradualmente
   - Monitorear métricas en cada fase

3. **Probar diferentes escenarios**
   - Tráfico normal
   - Picos de carga
   - Carga sostenida

4. **Monitorear recursos del servidor**
   - CPU usage
   - Memory usage
   - Database connections
   - Network I/O

5. **Documentar resultados**
   - Guardar reportes
   - Comparar con pruebas anteriores
   - Identificar regresiones

## Troubleshooting

### Error: "Cannot connect to target"
- Verifica que el servidor esté corriendo
- Verifica la URL en `load-test.yml`
- Verifica firewall/red

### Error: "Too many open files"
- Aumenta límite: `ulimit -n 4096`
- Reduce `arrivalRate` en las fases

### Tiempos de respuesta muy altos
- Revisa logs del servidor
- Verifica que Redis/caché esté funcionando
- Revisa queries de base de datos
- Verifica recursos del servidor

## Próximos Pasos

Después de ejecutar load tests:

1. Analizar resultados
2. Identificar cuellos de botella
3. Optimizar endpoints lentos
4. Ajustar configuración de recursos
5. Re-ejecutar pruebas para validar mejoras

---

**Última actualización**: Día 14 - Load Testing
**Estado**: Configuración lista para usar ✅


