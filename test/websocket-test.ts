/**
 * Script de Testing para WebSockets de Pedidos
 * 
 * Este script permite probar la funcionalidad de WebSockets en tiempo real
 * para notificaciones de pedidos.
 * 
 * Uso:
 * 1. Asegúrate de que el servidor esté corriendo (npm run start:dev)
 * 2. Ejecuta: npx ts-node test/websocket-test.ts
 * 
 * Requisitos:
 * - Tener un restaurante creado (restaurantId)
 * - Tener un usuario estudiante (userId) - opcional para testing completo
 */

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const NAMESPACE = '/orders';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logEvent(event: string, data: any) {
  log(`\n[EVENTO] ${event}`, colors.cyan);
  console.log(JSON.stringify(data, null, 2));
}

// Configuración de prueba - MODIFICA ESTOS VALORES
const TEST_CONFIG = {
  restaurantId: 'TU_RESTAURANT_ID_AQUI',
  userId: 'TU_USER_ID_AQUI', // Opcional
};

/**
 * Cliente de prueba para restaurante
 */
function createRestaurantClient(restaurantId: string, userId?: string): Socket {
  log(`\n${colors.bright}=== Cliente Restaurante ===${colors.reset}`, colors.green);
  log(`Conectando a ${SERVER_URL}${NAMESPACE}...`, colors.yellow);

  const socket = io(`${SERVER_URL}${NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    log('✅ Conectado al servidor WebSocket', colors.green);
    
    // Unirse a la sala del restaurante
    log(`\nUniéndose a la sala del restaurante: ${restaurantId}`, colors.yellow);
    socket.emit('join-restaurant-room', {
      restaurantId,
      userId: userId || 'test-restaurant-user',
    });
  });

  socket.on('joined-restaurant-room', (data) => {
    log(`✅ Unido a la sala: ${data.room}`, colors.green);
    logEvent('joined-restaurant-room', data);
  });

  socket.on('new-order', (data) => {
    log('\n🔔 NUEVO PEDIDO RECIBIDO', colors.magenta);
    logEvent('new-order', data);
  });

  socket.on('order-status-changed', (data) => {
    log('\n📝 CAMBIO DE ESTADO DE PEDIDO', colors.blue);
    logEvent('order-status-changed', data);
  });

  socket.on('error', (error) => {
    log(`\n❌ Error: ${JSON.stringify(error)}`, colors.red);
  });

  socket.on('disconnect', (reason) => {
    log(`\n⚠️  Desconectado: ${reason}`, colors.yellow);
  });

  socket.on('connect_error', (error) => {
    log(`\n❌ Error de conexión: ${error.message}`, colors.red);
  });

  socket.on('reconnect', (attemptNumber) => {
    log(`\n🔄 Reconectado después de ${attemptNumber} intentos`, colors.green);
    // Re-uniéndose a la sala después de reconexión
    socket.emit('join-restaurant-room', {
      restaurantId,
      userId: userId || 'test-restaurant-user',
    });
  });

  return socket;
}

/**
 * Cliente de prueba para estudiante
 */
function createStudentClient(userId: string): Socket {
  log(`\n${colors.bright}=== Cliente Estudiante ===${colors.reset}`, colors.green);
  log(`Conectando a ${SERVER_URL}${NAMESPACE}...`, colors.yellow);

  const socket = io(`${SERVER_URL}${NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    log('✅ Conectado al servidor WebSocket', colors.green);
  });

  socket.on('order-status-changed', (data) => {
    log('\n📝 CAMBIO DE ESTADO DE MI PEDIDO', colors.magenta);
    logEvent('order-status-changed', data);
  });

  socket.on('error', (error) => {
    log(`\n❌ Error: ${JSON.stringify(error)}`, colors.red);
  });

  socket.on('disconnect', (reason) => {
    log(`\n⚠️  Desconectado: ${reason}`, colors.yellow);
  });

  socket.on('connect_error', (error) => {
    log(`\n❌ Error de conexión: ${error.message}`, colors.red);
  });

  return socket;
}

/**
 * Función principal de testing
 */
async function runTests() {
  log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`, colors.cyan);
  log(`${colors.bright}  TESTING DE WEBSOCKETS - UNIFOODAPP${colors.reset}`, colors.cyan);
  log(`${colors.bright}${'='.repeat(60)}${colors.reset}\n`, colors.cyan);

  // Verificar configuración
  if (TEST_CONFIG.restaurantId === 'TU_RESTAURANT_ID_AQUI') {
    log('⚠️  ADVERTENCIA: Debes configurar TEST_CONFIG en el script', colors.yellow);
    log('   - restaurantId: ID del restaurante a probar', colors.yellow);
    log('   - userId: ID del usuario (opcional)', colors.yellow);
    log('\nContinuando con valores de prueba...\n', colors.yellow);
  }

  // Crear cliente de restaurante
  const restaurantSocket = createRestaurantClient(
    TEST_CONFIG.restaurantId,
    TEST_CONFIG.userId,
  );

  // Crear cliente de estudiante (opcional)
  let studentSocket: Socket | null = null;
  if (TEST_CONFIG.userId && TEST_CONFIG.userId !== 'TU_USER_ID_AQUI') {
    studentSocket = createStudentClient(TEST_CONFIG.userId);
  }

  // Mantener el script corriendo
  log(`\n${colors.bright}Script de testing activo. Presiona Ctrl+C para salir.${colors.reset}`, colors.cyan);
  log('\n📋 Instrucciones:', colors.yellow);
  log('1. Crea un pedido usando POST /orders desde otro cliente (Postman, curl, etc.)', colors.yellow);
  log('2. El cliente restaurante debería recibir el evento "new-order"', colors.yellow);
  log('3. Actualiza el estado del pedido usando PATCH /orders/:id/status', colors.yellow);
  log('4. Ambos clientes deberían recibir el evento "order-status-changed"', colors.yellow);
  log('5. Prueba desconectar y reconectar para verificar reconexión automática', colors.yellow);

  // Manejar cierre limpio
  process.on('SIGINT', () => {
    log('\n\nCerrando conexiones...', colors.yellow);
    restaurantSocket.disconnect();
    if (studentSocket) {
      studentSocket.disconnect();
    }
    log('✅ Conexiones cerradas. Adiós!', colors.green);
    process.exit(0);
  });
}

// Ejecutar tests
runTests().catch((error) => {
  log(`\n❌ Error fatal: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

