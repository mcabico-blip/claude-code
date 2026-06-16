import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env' });

/**
 * TypeORM CLI data-source — used only by migration:generate / migration:run.
 * The NestJS app uses TypeOrmModule.forRootAsync in app.module.ts.
 * Set DB_SYNC=false in production and run migrations instead.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'ubi',
  password: process.env.DB_PASS ?? 'ubi_dev',
  database: process.env.DB_NAME ?? 'ubi_suite',
  entities: ['src/**/*.entity.ts', 'src/modules/**/*.module.ts', 'src/modules/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
