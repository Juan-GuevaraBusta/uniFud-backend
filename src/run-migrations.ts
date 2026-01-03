import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.join(__dirname, '..', '.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'unifood_db',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

dataSource
  .initialize()
  .then(async () => {
    console.log('Data Source has been initialized!');
    console.log('Running migrations...');
    await dataSource.runMigrations();
    console.log('Migrations completed successfully!');
    await dataSource.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during migration:', error);
    process.exit(1);
  });

