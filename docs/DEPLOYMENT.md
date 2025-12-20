# Guía de Despliegue - UniFoodApp Backend

## Tabla de Contenidos

1. [Requisitos del Servidor](#requisitos-del-servidor)
2. [Variables de Entorno](#variables-de-entorno)
3. [Proceso de Despliegue](#proceso-de-despliegue)
4. [Opciones de Hosting](#opciones-de-hosting)
5. [Post-Despliegue](#post-despliegue)
6. [Rollback](#rollback)
7. [Monitoreo](#monitoreo)
8. [Troubleshooting](#troubleshooting)

---

## Requisitos del Servidor

### Mínimos

- **CPU**: 1 core
- **RAM**: 512 MB
- **Disco**: 10 GB
- **Node.js**: >= 18.x
- **PostgreSQL**: >= 15.x

### Recomendados (Producción)

- **CPU**: 2+ cores
- **RAM**: 2+ GB
- **Disco**: 50+ GB (SSD preferible)
- **Node.js**: 18.x LTS o 20.x LTS
- **PostgreSQL**: 15.x o superior

### Red

- Puerto **3000** (o el configurado) abierto para HTTP
- Puerto **5432** para PostgreSQL (si está en el mismo servidor)
- Firewall configurado correctamente

---

## Variables de Entorno

### Variables Requeridas en Producción

Crear archivo `.env` en el servidor con:

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DB_HOST=tu-host-postgresql
DB_PORT=5432
DB_USERNAME=unifood_prod
DB_PASSWORD=password_super_seguro_cambiar
DB_NAME=unifood_db_prod

# JWT (¡CAMBIAR EN PRODUCCIÓN!)
JWT_SECRET=secreto-super-seguro-minimo-32-caracteres
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=refresh-secreto-super-seguro-minimo-32-caracteres
JWT_REFRESH_EXPIRATION=7d

# CORS
CORS_ORIGIN=https://unifoodapp.com,exp://tu-dominio-expo

# Expo Push Notifications (opcional)
EXPO_ACCESS_TOKEN=tu-expo-access-token

# Logging
LOG_LEVEL=info
```

### Generar Secretos Seguros

```bash
# Generar JWT_SECRET
openssl rand -base64 32

# Generar JWT_REFRESH_SECRET
openssl rand -base64 32
```

### Seguridad

- **Nunca** commitees el archivo `.env` a Git
- Usa un gestor de secretos (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rota los secretos periódicamente
- Usa diferentes secretos por ambiente (dev, staging, prod)

---

## Proceso de Despliegue

### Pre-Despliegue

1. **Verificar Tests**
   ```bash
   npm run test
   npm run test:e2e
   ```

2. **Build de Producción**
   ```bash
   npm run build
   ```

3. **Verificar que el Build Funciona**
   ```bash
   npm run start:prod
   ```

### Opción 1: Despliegue Manual

#### 1. Preparar el Servidor

```bash
# Conectar al servidor
ssh usuario@tu-servidor.com

# Instalar Node.js (si no está instalado)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL (si no está instalado)
sudo apt-get install postgresql postgresql-contrib
```

#### 2. Clonar el Repositorio

```bash
cd /var/www
git clone https://github.com/Juan-GuevaraBusta/uniFud-backend.git
cd uni-fud-backend
```

#### 3. Instalar Dependencias

```bash
npm ci --only=production
```

#### 4. Configurar Variables de Entorno

```bash
# Crear archivo .env
nano .env
# Pegar las variables de entorno de producción
```

#### 5. Configurar Base de Datos

```bash
# Crear base de datos
sudo -u postgres psql
CREATE DATABASE unifood_db_prod;
CREATE USER unifood_prod WITH PASSWORD 'password_seguro';
GRANT ALL PRIVILEGES ON DATABASE unifood_db_prod TO unifood_prod;
\q
```

#### 6. Ejecutar Migraciones

```bash
npm run build
npm run migration:run
```

#### 7. Iniciar la Aplicación

**Con PM2 (Recomendado)**:

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start dist/main.js --name unifood-backend

# Configurar para iniciar al arrancar el servidor
pm2 startup
pm2 save
```

**Con systemd**:

Crear `/etc/systemd/system/unifood-backend.service`:

```ini
[Unit]
Description=UniFoodApp Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/uni-fud-backend
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Activar servicio:

```bash
sudo systemctl enable unifood-backend
sudo systemctl start unifood-backend
```

### Opción 2: Despliegue con Docker

#### 1. Crear Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

#### 2. Crear docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=unifood_prod
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=unifood_db_prod
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=unifood_db_prod
      - POSTGRES_USER=unifood_prod
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Desplegar

```bash
docker-compose up -d
```

### Opción 3: Plataformas Cloud

#### Railway

1. Conectar repositorio de GitHub
2. Railway detecta automáticamente Node.js
3. Agregar servicio PostgreSQL
4. Configurar variables de entorno
5. Deploy automático en cada push

#### Render

1. Crear nuevo servicio "Web Service"
2. Conectar repositorio
3. Configurar:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
4. Agregar base de datos PostgreSQL
5. Configurar variables de entorno

#### Heroku

```bash
# Instalar Heroku CLI
heroku login

# Crear aplicación
heroku create unifood-backend

# Agregar PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Configurar variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=tu-secreto

# Desplegar
git push heroku main
```

---

## Post-Despliegue

### Verificar que la Aplicación Funciona

```bash
# Health check
curl http://tu-servidor.com:3000

# Verificar Swagger
curl http://tu-servidor.com:3000/api/docs
```

### Configurar Nginx (Recomendado)

Crear `/etc/nginx/sites-available/unifood-backend`:

```nginx
server {
    listen 80;
    server_name api.unifoodapp.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Habilitar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/unifood-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d api.unifoodapp.com

# Renovación automática (ya está configurada)
sudo certbot renew --dry-run
```

---

## Rollback

### Rollback Manual

#### 1. Detener Aplicación Actual

```bash
# Con PM2
pm2 stop unifood-backend

# Con systemd
sudo systemctl stop unifood-backend

# Con Docker
docker-compose down
```

#### 2. Revertir a Versión Anterior

```bash
# Con Git
git checkout <commit-hash-anterior>
npm ci --only=production
npm run build

# O restaurar backup
cp -r backup/dist ./dist
```

#### 3. Revertir Migraciones (si es necesario)

```bash
npm run migration:revert
```

#### 4. Reiniciar Aplicación

```bash
# Con PM2
pm2 restart unifood-backend

# Con systemd
sudo systemctl start unifood-backend

# Con Docker
docker-compose up -d
```

### Rollback Automático con PM2

```bash
# PM2 mantiene versiones anteriores automáticamente
pm2 list
pm2 restart unifood-backend --update-env
```

### Backup de Base de Datos Antes de Rollback

```bash
# Crear backup
pg_dump -U unifood_prod -d unifood_db_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Si necesitas restaurar
psql -U unifood_prod -d unifood_db_prod < backup_20240115_120000.sql
```

---

## Monitoreo

### Logs

#### PM2

```bash
# Ver logs en tiempo real
pm2 logs unifood-backend

# Ver últimos 100 líneas
pm2 logs unifood-backend --lines 100

# Limpiar logs
pm2 flush
```

#### systemd

```bash
# Ver logs
sudo journalctl -u unifood-backend -f

# Ver últimos logs
sudo journalctl -u unifood-backend -n 100
```

#### Docker

```bash
# Ver logs
docker-compose logs -f api

# Ver últimos logs
docker-compose logs --tail=100 api
```

### Métricas

#### PM2 Monitoring

```bash
# Ver métricas en tiempo real
pm2 monit
```

#### Health Check Endpoint

Crear endpoint de health check (si no existe):

```typescript
@Get('health')
health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}
```

Verificar:

```bash
curl http://tu-servidor.com:3000/health
```

### Alertas

Configurar alertas para:
- CPU > 80%
- Memoria > 80%
- Disco > 90%
- Aplicación caída
- Errores 5xx > 10 en 1 minuto

---

## Troubleshooting

### La Aplicación No Inicia

1. **Verificar Logs**
   ```bash
   pm2 logs unifood-backend
   # o
   sudo journalctl -u unifood-backend
   ```

2. **Verificar Variables de Entorno**
   ```bash
   # Con PM2
   pm2 env unifood-backend
   ```

3. **Verificar Puerto**
   ```bash
   lsof -i :3000
   ```

4. **Verificar Base de Datos**
   ```bash
   psql -U unifood_prod -d unifood_db_prod -h localhost
   ```

### Errores de Conexión a Base de Datos

1. Verificar que PostgreSQL esté corriendo
2. Verificar credenciales en `.env`
3. Verificar firewall/security groups
4. Verificar que la base de datos exista

### Alto Uso de Memoria

1. **Revisar procesos**
   ```bash
   pm2 monit
   ```

2. **Reiniciar aplicación**
   ```bash
   pm2 restart unifood-backend
   ```

3. **Aumentar límite de memoria de Node.js**
   ```bash
   pm2 start dist/main.js --name unifood-backend --max-memory-restart 500M
   ```

### Errores 502 Bad Gateway (Nginx)

1. Verificar que la aplicación esté corriendo
2. Verificar configuración de Nginx
3. Verificar logs de Nginx:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Certificado SSL Expirado

```bash
# Renovar certificado
sudo certbot renew

# Reiniciar Nginx
sudo systemctl reload nginx
```

---

## Checklist de Despliegue

### Pre-Despliegue

- [ ] Tests pasando (`npm run test`)
- [ ] Build exitoso (`npm run build`)
- [ ] Variables de entorno configuradas
- [ ] Secretos generados y seguros
- [ ] Base de datos creada y migraciones ejecutadas
- [ ] Backup de base de datos (si es actualización)

### Despliegue

- [ ] Código desplegado en servidor
- [ ] Dependencias instaladas (`npm ci --only=production`)
- [ ] Variables de entorno configuradas
- [ ] Aplicación iniciada correctamente
- [ ] Health check respondiendo
- [ ] Swagger accesible

### Post-Despliegue

- [ ] Probar endpoints principales
- [ ] Verificar logs sin errores críticos
- [ ] Verificar métricas (CPU, memoria)
- [ ] Notificar al equipo
- [ ] Monitorear por 1 hora

---

## Recursos Adicionales

- [Guía de Desarrollo](./DEVELOPMENT.md)
- [Documentación de la API](./API.md)
- [Documentación de NestJS](https://docs.nestjs.com/)
- [Documentación de PM2](https://pm2.keymetrics.io/docs/)

---

**Última actualización**: Enero 2024  
**Versión**: 1.0.0


