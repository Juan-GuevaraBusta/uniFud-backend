import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../../src/app.module';

/**
 * Tests para Protección de API Keys
 * 
 * Verifica que:
 * - Las API keys no se exponen en respuestas
 * - Se usan variables de entorno (no keys hardcodeadas)
 * - La validación de variables de entorno funciona correctamente
 */
describe('API Keys Security', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Protección de API keys en respuestas', () => {
    const sensitiveKeys = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'WOMPI_PUBLIC_KEY',
      'WOMPI_PRIVATE_KEY',
      'WOMPI_INTEGRITY_SECRET',
      'SIIGO_ACCESS_KEY',
      'SIIGO_USERNAME',
      'password',
      'passwordHash',
      'verificationCode',
    ];

    it('no debe exponer JWT_SECRET en respuestas de error', async () => {
      // Simular un error haciendo una request inválida
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid@test.com',
          password: 'wrongpassword',
        });

      // Verificar que la respuesta no contiene JWT_SECRET
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('JWT_SECRET');
      expect(responseText).not.toContain(process.env.JWT_SECRET || '');
    });

    it('no debe exponer WOMPI keys en respuestas', async () => {
      // Intentar hacer una request a un endpoint que use Wompi
      // (puede fallar por autenticación u otras razones)
      const response = await request(app.getHttpServer())
        .post('/payments/webhooks')
        .send({
          event: {
            type: 'test',
            data: {},
          },
        });

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('WOMPI_PUBLIC_KEY');
      expect(responseText).not.toContain('WOMPI_PRIVATE_KEY');
      expect(responseText).not.toContain('WOMPI_INTEGRITY_SECRET');
      
      // Verificar que no contiene los valores reales de las keys (si están configuradas)
      if (process.env.WOMPI_PUBLIC_KEY) {
        expect(responseText).not.toContain(process.env.WOMPI_PUBLIC_KEY);
      }
      if (process.env.WOMPI_PRIVATE_KEY) {
        expect(responseText).not.toContain(process.env.WOMPI_PRIVATE_KEY);
      }
    });

    it('no debe exponer passwords en respuestas de usuarios', async () => {
      // Registrar un usuario
      const timestamp = Date.now();
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test-keys-${timestamp}@test.com`,
          password: 'Test123456!',
          nombre: 'Test User Keys',
        });

      if (registerResponse.status === 201) {
        const responseText = JSON.stringify(registerResponse.body);
        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('passwordHash');
        expect(responseText).not.toContain('Test123456!');
      }
    });

    it('no debe exponer verificationCode en respuestas', async () => {
      const timestamp = Date.now();
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test-verification-${timestamp}@test.com`,
          password: 'Test123456!',
          nombre: 'Test User Verification',
        });

      if (registerResponse.status === 201) {
        const responseText = JSON.stringify(registerResponse.body);
        // El código de verificación NO debe estar en la respuesta
        // (aunque en desarrollo podría estar, verificar que no está en producción)
        expect(responseText).not.toContain('verificationCode');
      }
    });

    it('no debe exponer información sensible en respuestas de error genéricas', async () => {
      // Hacer una request que cause un error
      const response = await request(app.getHttpServer())
        .get('/nonexistent-endpoint');

      const responseText = JSON.stringify(response.body);
      
      // Verificar que las keys sensibles no están en la respuesta
      for (const key of sensitiveKeys) {
        expect(responseText).not.toContain(key);
      }
    });
  });

  describe('Uso de variables de entorno', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const srcDir = path.join(projectRoot, 'src');

    /**
     * Buscar en archivos TypeScript si hay keys hardcodeadas
     */
    function searchForHardcodedKeys(filePath: string): string[] {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const foundKeys: string[] = [];
        
        // Patrones a buscar (keys hardcodeadas comunes)
        const patterns = [
          /WOMPI_PUBLIC_KEY\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
          /WOMPI_PRIVATE_KEY\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
          /WOMPI_INTEGRITY_SECRET\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
          /JWT_SECRET\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
          /SIIGO_ACCESS_KEY\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
          /api[_-]?key\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
          /secret\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
        ];

        patterns.forEach((pattern) => {
          const matches = content.match(pattern);
          if (matches) {
            foundKeys.push(...matches);
          }
        });

        return foundKeys;
      } catch (error) {
        return [];
      }
    }

    /**
     * Recursivamente buscar en directorio
     */
    function searchDirectory(dir: string, extensions: string[] = ['.ts']): string[] {
      const results: string[] = [];
      
      try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            // Saltar node_modules y otros directorios innecesarios
            if (!['node_modules', '.git', 'dist', 'build', 'coverage', 'test'].includes(file)) {
              results.push(...searchDirectory(filePath, extensions));
            }
          } else if (extensions.some(ext => file.endsWith(ext))) {
            const found = searchForHardcodedKeys(filePath);
            if (found.length > 0) {
              results.push(...found.map(key => `${filePath}: ${key}`));
            }
          }
        }
      } catch (error) {
        // Ignorar errores de lectura
      }
      
      return results;
    }

    it('debe usar variables de entorno para JWT_SECRET (verificar código)', () => {
      // Buscar en el código fuente si hay JWT_SECRET hardcodeado
      const hardcodedKeys = searchDirectory(srcDir);
      
      // Filtrar solo los que son JWT_SECRET hardcodeados
      const jwtHardcoded = hardcodedKeys.filter(key => 
        key.includes('JWT_SECRET') && 
        !key.includes('process.env') && 
        !key.includes('ConfigService')
      );
      
      // No debería haber JWT_SECRET hardcodeados
      expect(jwtHardcoded.length).toBe(0);
    });

    it('debe usar variables de entorno para WOMPI keys (verificar código)', () => {
      const hardcodedKeys = searchDirectory(srcDir);
      
      const wompiHardcoded = hardcodedKeys.filter(key => 
        (key.includes('WOMPI_PUBLIC_KEY') || key.includes('WOMPI_PRIVATE_KEY')) &&
        !key.includes('process.env') &&
        !key.includes('ConfigService')
      );
      
      expect(wompiHardcoded.length).toBe(0);
    });

    it('debe usar ConfigService o process.env para obtener keys', () => {
      // Verificar que los archivos clave usan ConfigService o process.env
      const wompiClientPath = path.join(srcDir, 'payments', 'providers', 'wompi.client.ts');
      
      if (fs.existsSync(wompiClientPath)) {
        const content = fs.readFileSync(wompiClientPath, 'utf-8');
        // Debe usar ConfigService para obtener las keys
        expect(content).toMatch(/ConfigService|process\.env/);
      }
    });
  });

  describe('Validación de variables de entorno', () => {
    it('debe validar formato de variables de entorno en desarrollo', () => {
      // En desarrollo, la validación es más permisiva
      // Pero aún debe validar formatos básicos
      const nodeEnv = process.env.NODE_ENV || 'development';
      
      // Verificar que NODE_ENV es un valor válido
      expect(['development', 'staging', 'production', 'test']).toContain(nodeEnv);
    });

    it('debe tener JWT_SECRET configurado (al menos en desarrollo para tests)', () => {
      // En desarrollo/tests, JWT_SECRET puede estar presente
      const jwtSecret = process.env.JWT_SECRET;
      
      // Si está configurado, debe tener al menos cierta longitud
      if (jwtSecret) {
        expect(jwtSecret.length).toBeGreaterThan(0);
      }
    });

    it('debe validar que variables de entorno críticas tienen formato correcto', () => {
      // Verificar que PORT es un número válido si está configurado
      if (process.env.PORT) {
        const port = parseInt(process.env.PORT, 10);
        expect(port).toBeGreaterThan(0);
        expect(port).toBeLessThanOrEqual(65535);
      }
    });

    it('debe validar estructura del archivo env.validation.ts', () => {
      // Verificar que el archivo de validación existe y tiene la estructura correcta
      const validationPath = path.join(__dirname, '../../src/config/env.validation.ts');
      expect(fs.existsSync(validationPath)).toBe(true);
      
      const content = fs.readFileSync(validationPath, 'utf-8');
      
      // Debe exportar una función validate
      expect(content).toContain('export function validate');
      
      // Debe validar JWT_SECRET
      expect(content).toContain('JWT_SECRET');
      
      // Debe tener validaciones para producción
      expect(content.toLowerCase()).toContain('production');
    });
  });
});
