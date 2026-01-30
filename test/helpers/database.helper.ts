import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Configurar variables de entorno para tests
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

config({ path: path.join(__dirname, '../../.env') });

let dataSource: DataSource | null = null;

/**
 * Obtiene o crea una instancia de DataSource para operaciones directas de BD
 * Útil para limpieza, seeders y queries raw
 */
export async function getDataSource(): Promise<DataSource> {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  // Usar base de datos de test si está configurada, sino usar la de desarrollo
  const testDbName = process.env.DB_NAME_TEST || process.env.DB_NAME || 'unifood_db';

  dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: testDbName,
    entities: [path.join(__dirname, '../../src/**/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false, // Desactivar logging en tests para mejor performance
  });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  return dataSource;
}

/**
 * Cierra la conexión de DataSource
 */
export async function closeDataSource(): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
  }
}

/**
 * Trunca una tabla específica (útil para limpieza rápida)
 * NOTA: Solo usar en tests, nunca en producción
 */
export async function truncateTable(tableName: string): Promise<void> {
  const ds = await getDataSource();
  await ds.query(`TRUNCATE TABLE ${tableName} CASCADE`);
}

/**
 * Ejecuta una query SQL raw
 * Útil para operaciones complejas que no se pueden hacer con TypeORM
 */
export async function executeRawQuery(query: string, parameters?: any[]): Promise<any> {
  const ds = await getDataSource();
  return await ds.query(query, parameters);
}

/**
 * Obtiene el conteo de registros en una tabla
 */
export async function getTableCount(tableName: string): Promise<number> {
  const ds = await getDataSource();
  const result = await ds.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return parseInt(result[0].count, 10);
}

/**
 * Desactiva temporalmente las foreign key constraints
 * Útil para limpieza rápida de BD
 * NOTA: Solo usar en tests
 */
export async function disableForeignKeys(): Promise<void> {
  const ds = await getDataSource();
  await ds.query('SET session_replication_role = replica');
}

/**
 * Reactiva las foreign key constraints
 */
export async function enableForeignKeys(): Promise<void> {
  const ds = await getDataSource();
  await ds.query('SET session_replication_role = DEFAULT');
}
