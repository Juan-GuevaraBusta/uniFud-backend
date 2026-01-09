import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import * as DOMPurify from 'dompurify';

/**
 * Pipe de sanitización para prevenir XSS, SQL injection y NoSQL injection
 * 
 * Aplica sanitización a todos los campos string de entrada:
 * - XSS: Usa DOMPurify para limpiar HTML malicioso
 * - SQL Injection: Limpia patrones peligrosos de SQL
 * - NoSQL Injection: Limpia operadores MongoDB peligrosos
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  private readonly domPurify: ReturnType<typeof DOMPurify>;
  private readonly sqlInjectionPatterns: RegExp[];
  private readonly nosqlInjectionPatterns: RegExp[];

  // Campos que NO deben sanitizarse (ya tienen validación específica o se procesan de forma especial)
  private readonly skipSanitizationFields = [
    'password',
    'currentPassword',
    'newPassword',
    'refreshToken',
    'accessToken',
    'token',
  ];

  constructor() {
    // Inicializar DOMPurify para Node.js
    const window = new JSDOM('').window;
    this.domPurify = DOMPurify(window as any);

    // Patrones de SQL injection a limpiar
    this.sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
      /(['";])/g, // Comillas simples, dobles y punto y coma
      /(--)/g, // Comentarios SQL
      /(\/\*|\*\/)/g, // Comentarios SQL multilínea
      /(;)/g, // Punto y coma
    ];

    // Patrones de NoSQL injection a limpiar
    this.nosqlInjectionPatterns = [
      /(\$where|\$ne|\$gt|\$gte|\$lt|\$lte|\$in|\$nin|\$regex|\$exists|\$or|\$and)/gi,
      /({[\s]*"\$)/g, // Objetos que empiezan con $ (operadores MongoDB)
    ];
  }

  /**
   * Transformar y sanitizar el valor de entrada
   */
  transform(value: any, metadata: ArgumentMetadata): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Si es un string, sanitizar directamente
    if (typeof value === 'string') {
      return this.sanitizeString(value, metadata?.data);
    }

    // Si es un array, sanitizar cada elemento
    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, metadata));
    }

    // Si es un objeto, sanitizar recursivamente
    if (typeof value === 'object' && value.constructor === Object) {
      return this.sanitizeObject(value);
    }

    // Para otros tipos (números, booleanos, etc.), retornar sin cambios
    return value;
  }

  /**
   * Sanitizar un string
   */
  private sanitizeString(value: string, fieldName?: string | number): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    // Si el campo está en la lista de exclusión, no sanitizar
    if (fieldName && this.skipSanitizationFields.includes(String(fieldName).toLowerCase())) {
      return value;
    }

    let sanitized = value;

    // 1. Sanitizar XSS usando DOMPurify
    sanitized = this.domPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [], // No permitir ningún tag HTML
      ALLOWED_ATTR: [], // No permitir ningún atributo
      KEEP_CONTENT: true, // Mantener el contenido de texto
    });

    // 2. Limpiar patrones de SQL injection
    sanitized = this.cleanSqlInjection(sanitized);

    // 3. Limpiar patrones de NoSQL injection
    sanitized = this.cleanNoSqlInjection(sanitized);

    // 4. Limpiar caracteres de control y espacios múltiples
    sanitized = sanitized
      .replace(/[\x00-\x1F\x7F]/g, '') // Caracteres de control
      .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
      .trim();

    return sanitized;
  }

  /**
   * Limpiar patrones de SQL injection
   */
  private cleanSqlInjection(value: string): string {
    let cleaned = value;

    // Limpiar palabras clave peligrosas de SQL
    cleaned = cleaned.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi, '');

    // Limpiar comentarios SQL
    cleaned = cleaned.replace(/--.*$/gm, ''); // Comentarios de línea
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ''); // Comentarios multilínea

    // Escapar comillas simples y dobles (reemplazar por versión escapada)
    cleaned = cleaned.replace(/'/g, "''"); // Escapar comillas simples
    cleaned = cleaned.replace(/"/g, '\\"'); // Escapar comillas dobles

    return cleaned;
  }

  /**
   * Limpiar patrones de NoSQL injection
   */
  private cleanNoSqlInjection(value: string): string {
    let cleaned = value;

    // Limpiar operadores MongoDB peligrosos
    cleaned = cleaned.replace(/(\$where|\$ne|\$gt|\$gte|\$lt|\$lte|\$in|\$nin|\$regex|\$exists|\$or|\$and)/gi, '');

    // Limpiar objetos JSON que contengan operadores MongoDB
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'object' && parsed !== null) {
        // Si es un objeto, limpiar propiedades que empiecen con $
        const cleanedObj = this.cleanObjectFromNoSqlOperators(parsed);
        cleaned = JSON.stringify(cleanedObj);
      }
    } catch {
      // Si no es JSON válido, continuar con la limpieza de string
    }

    return cleaned;
  }

  /**
   * Limpiar operadores NoSQL de un objeto
   */
  private cleanObjectFromNoSqlOperators(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanObjectFromNoSqlOperators(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Omitir propiedades que empiecen con $ (operadores MongoDB)
        if (!key.startsWith('$')) {
          cleaned[key] = this.cleanObjectFromNoSqlOperators(value);
        }
      }
      return cleaned;
    }

    return obj;
  }

  /**
   * Sanitizar un objeto recursivamente
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitizar la clave también (por si acaso)
      const sanitizedKey = this.sanitizeString(key);

      // Si el campo está en la lista de exclusión, no sanitizar el valor
      if (this.skipSanitizationFields.includes(key.toLowerCase())) {
        sanitized[sanitizedKey] = value;
        continue;
      }

      // Sanitizar el valor recursivamente
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value, key);
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map((item) => this.transform(item, { data: key } as ArgumentMetadata));
      } else if (typeof value === 'object' && value !== null && value.constructor === Object) {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }
}

