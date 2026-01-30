# Guía de Tests E2E - UniFoodApp Backend

Esta guía explica cómo usar la infraestructura centralizada de tests E2E del proyecto.

## Estructura

```
test/
├── setup.ts                    # Setup principal con funciones de limpieza y seeders
├── jest-e2e.json              # Configuración de Jest para E2E
├── helpers/
│   ├── database.helper.ts    # Helpers para operaciones de BD
│   └── test-data.helper.ts   # Helpers para crear datos de prueba
├── seeders/
│   └── base.seeder.ts         # Seeders reutilizables
└── [tests existentes...]
```

## Configuración

### Variables de Entorno

Los tests E2E usan las mismas variables de entorno que el proyecto principal. Opcionalmente, puedes crear un archivo `.env.test` para usar una base de datos separada:

```env
# .env.test (opcional)
DB_NAME=unifood_test_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

**Recomendación**: Usar una base de datos separada para tests (`unifood_test_db`) para evitar conflictos con datos de desarrollo.

### Ejecutar Tests

```bash
# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar un test específico
npm run test:e2e -- orders-integration.e2e-spec.ts

# Ejecutar tests en modo watch
npm run test:e2e -- --watch
```

## Uso Básico

### Ejemplo Simple

```typescript
import { cleanDatabase, seedTestData, getTestApp, closeTestApp } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Mi Test E2E', () => {
  let app: INestApplication;
  let testData: any;

  beforeAll(async () => {
    // Obtener aplicación de test
    const { app: testApp } = await getTestApp();
    app = testApp;

    // Limpiar BD antes de empezar
    await cleanDatabase();

    // Crear datos base
    testData = await seedTestData();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('debe hacer algo con los datos de prueba', async () => {
    // Usar testData.studentToken, testData.restaurantId, etc.
    expect(testData.studentToken).toBeDefined();
  });
});
```

## Funciones Principales

### `getTestApp()`

Crea y retorna una aplicación NestJS lista para tests. Incluye mocks automáticos de WompiClient si no hay credenciales configuradas.

```typescript
const { app, module } = await getTestApp();
```

### `cleanDatabase()`

Limpia todas las tablas de la base de datos en orden correcto, respetando foreign keys.

```typescript
await cleanDatabase();
```

**Nota**: Esta función es destructiva. Solo usar en tests.

### `seedTestData()`

Crea datos base reutilizables:
- Universidad de prueba
- Usuario estudiante (con token)
- Usuario restaurante owner (con token)
- Restaurante de prueba
- Platos de prueba (3 tipos diferentes)
- Disponibilidad de platos

```typescript
const testData = await seedTestData();
// testData contiene:
// - universityId
// - studentId, studentEmail, studentToken
// - restaurantOwnerId, restaurantOwnerEmail, restaurantOwnerToken
// - restaurantId
// - dishIds (array)
```

### `getAuthToken(email, password)`

Obtiene un token JWT para un usuario.

```typescript
const token = await getAuthToken('user@example.com', 'password123');
```

### `confirmUserEmail(email)`

Confirma el email de un usuario obteniendo el código desde la BD.

```typescript
await confirmUserEmail('user@example.com');
```

## Helpers de Datos de Prueba

### `createTestUser()`

Crea un usuario de prueba completo (registro + confirmación + login).

```typescript
import { createTestUser } from './helpers/test-data.helper';

const { user, token } = await createTestUser(app, module, {
  email: 'custom@example.com',
  password: 'Test123456!',
  nombre: 'Usuario Personalizado',
  role: UserRole.STUDENT,
});
```

### `createTestUniversity()`

Crea una universidad de prueba.

```typescript
import { createTestUniversity } from './helpers/test-data.helper';

const university = await createTestUniversity(module, {
  nombre: 'Universidad Nacional',
  ciudad: 'Bogotá',
});
```

### `createTestRestaurant()`

Crea un restaurante de prueba.

```typescript
import { createTestRestaurant } from './helpers/test-data.helper';

const restaurant = await createTestRestaurant(module, {
  universityId: testData.universityId,
  ownerId: testData.restaurantOwnerId,
  nombre: 'Mi Restaurante',
  categorias: ['Pizza', 'Pasta'],
});
```

### `createTestDish()`

Crea un plato de prueba.

```typescript
import { createTestDish } from './helpers/test-data.helper';

const dish = await createTestDish(module, {
  restaurantId: testData.restaurantId,
  nombre: 'Pizza Personalizada',
  precio: 20000,
  categoria: 'Pizza',
  tipoPlato: DishType.PERSONALIZABLE,
  toppings: [
    { nombre: 'Queso extra', precio: 2000, removible: false },
    { nombre: 'Pepperoni', precio: 3000, removible: true },
  ],
});
```

### `createTestOrder()`

Crea un pedido de prueba vía API.

```typescript
import { createTestOrder } from './helpers/test-data.helper';

const order = await createTestOrder(app, module, testData.studentToken, {
  userId: testData.studentId,
  restaurantId: testData.restaurantId,
  items: [
    {
      dishId: testData.dishIds[0],
      dishNombre: 'Pizza Margarita',
      cantidad: 1,
      precioUnitario: 15000,
      precioTotal: 15000,
    },
  ],
  paymentSourceId: cardId, // Opcional
});
```

### `createTestCard()`

Crea una tarjeta de prueba (usa mocks de Wompi si no hay credenciales).

```typescript
import { createTestCard } from './helpers/test-data.helper';

const card = await createTestCard(app, testData.studentToken, {
  userId: testData.studentId,
  isDefault: true,
});
```

## Seeders

Los seeders permiten crear múltiples registros de prueba de forma rápida.

### `seedUniversities()`

Crea múltiples universidades.

```typescript
import { seedUniversities } from './seeders/base.seeder';

const { universities } = await seedUniversities(module, 5); // 5 universidades
```

### `seedUsers()`

Crea múltiples usuarios (estudiantes, owners, admins).

```typescript
import { seedUsers } from './seeders/base.seeder';

const { students, restaurantOwners, admins } = await seedUsers(module, {
  studentsCount: 10,
  restaurantOwnersCount: 5,
  adminsCount: 2,
});
```

### `seedRestaurants()`

Crea múltiples restaurantes.

```typescript
import { seedRestaurants } from './seeders/base.seeder';

const universityIds = universities.map((u) => u.id);
const ownerIds = restaurantOwners.map((o) => o.id);

const { restaurants } = await seedRestaurants(module, universityIds, ownerIds, 2);
// 2 restaurantes por universidad
```

### `seedDishes()`

Crea múltiples platos.

```typescript
import { seedDishes } from './seeders/base.seeder';

const restaurantIds = restaurants.map((r) => r.id);
const { dishes } = await seedDishes(module, restaurantIds, 5);
// 5 platos por restaurante
```

### `seedAvailability()`

Crea disponibilidad para platos.

```typescript
import { seedAvailability } from './seeders/base.seeder';

const dishIds = dishes.map((d) => d.id);
const restaurantIds = restaurants.map((r) => r.id);

const { availabilities } = await seedAvailability(module, dishIds, restaurantIds, 0.8);
// 80% de platos disponibles
```

## Helpers de Base de Datos

### `getDataSource()`

Obtiene una instancia de DataSource para operaciones directas.

```typescript
import { getDataSource } from './helpers/database.helper';

const ds = await getDataSource();
const users = await ds.query('SELECT * FROM users');
```

### `truncateTable()`

Trunca una tabla específica.

```typescript
import { truncateTable } from './helpers/database.helper';

await truncateTable('users');
```

### `executeRawQuery()`

Ejecuta una query SQL raw.

```typescript
import { executeRawQuery } from './helpers/database.helper';

const result = await executeRawQuery('SELECT COUNT(*) FROM orders WHERE status = $1', ['PENDIENTE']);
```

### `getTableCount()`

Obtiene el conteo de registros en una tabla.

```typescript
import { getTableCount } from './helpers/database.helper';

const count = await getTableCount('orders');
```

## Mejores Prácticas

### 1. Limpieza de BD

- **Siempre** limpiar la BD antes de cada suite de tests (`beforeAll`)
- **No** limpiar antes de cada test individual (muy lento)
- Usar `cleanDatabase()` para limpieza completa

### 2. Datos de Prueba

- Usar `seedTestData()` para datos base comunes
- Usar helpers específicos (`createTestUser`, etc.) para datos personalizados
- Usar seeders para crear múltiples registros cuando sea necesario

### 3. Tokens y Autenticación

- Usar `getAuthToken()` o los tokens de `seedTestData()`
- No hardcodear tokens (pueden expirar)
- Confirmar emails antes de usar usuarios en tests

### 4. Mocks

- WompiClient se mockea automáticamente si no hay credenciales
- Para otros servicios, usar `overrideProvider()` en `getTestApp()`

### 5. Performance

- Limpiar BD solo cuando sea necesario
- Reutilizar datos de prueba cuando sea posible
- Usar `maxWorkers: 1` en Jest para evitar conflictos de BD

### 6. Organización

- Agrupar tests relacionados en el mismo `describe`
- Usar `beforeAll` para setup costoso
- Usar `afterAll` para cleanup

## Ejemplo Completo

```typescript
import { cleanDatabase, seedTestData, getTestApp, closeTestApp } from './setup';
import { createTestOrder } from './helpers/test-data.helper';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Flujo Completo de Pedidos', () => {
  let app: INestApplication;
  let testData: any;

  beforeAll(async () => {
    const { app: testApp } = await getTestApp();
    app = testApp;

    await cleanDatabase();
    testData = await seedTestData();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Crear Pedido', () => {
    it('debe crear un pedido exitosamente', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items: [
            {
              dishId: testData.dishIds[0],
              dishNombre: 'Pizza Margarita',
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
    });
  });

  describe('Actualizar Estado', () => {
    it('debe actualizar el estado del pedido', async () => {
      // Crear pedido primero
      const order = await createTestOrder(app, module, testData.studentToken, {
        userId: testData.studentId,
        restaurantId: testData.restaurantId,
        items: [
          {
            dishId: testData.dishIds[0],
            dishNombre: 'Pizza Margarita',
            cantidad: 1,
            precioUnitario: 15000,
            precioTotal: 15000,
          },
        ],
      });

      // Actualizar estado
      const response = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          status: 'ACEPTADO',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('ACEPTADO');
    });
  });
});
```

## Troubleshooting

### Error: "Cannot find module './setup'"

Asegúrate de que el archivo `test/setup.ts` existe y que estás importando correctamente.

### Error: "Database connection failed"

Verifica que:
- PostgreSQL está corriendo
- Las variables de entorno están configuradas correctamente
- La base de datos existe

### Error: "User already exists"

La BD no se limpió correctamente. Asegúrate de llamar `cleanDatabase()` en `beforeAll`.

### Tests muy lentos

- Verifica que `maxWorkers: 1` está en `jest-e2e.json`
- No limpies la BD antes de cada test
- Reutiliza datos de prueba cuando sea posible

### Tokens expirados

Los tokens JWT tienen expiración. Si un test tarda mucho, puede que el token expire. Usa `getAuthToken()` para obtener un nuevo token cuando sea necesario.

## Recursos Adicionales

- [Documentación de Jest](https://jestjs.io/docs/getting-started)
- [Documentación de Supertest](https://github.com/visionmedia/supertest)
- [Documentación de NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
