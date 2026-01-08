import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { join } from 'path';

const isProduction = process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
  // Logs de error a archivo
  new winston.transports.File({
    filename: join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Todos los logs a archivo
  new winston.transports.File({
    filename: join(process.cwd(), 'logs', 'app.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// En desarrollo, agregar formato pretty a la consola
if (!isProduction) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
          ({ timestamp, level, message, context, ...meta }) => {
            const contextStr = context ? `[${context}]` : '';
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} ${level} ${contextStr} ${message} ${metaStr}`;
          },
        ),
      ),
    }),
  );
} else {
  // En producción, también loguear a consola pero en formato JSON
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
}

export const loggerConfig: WinstonModuleOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: 'unifood-api' },
  transports,
};

