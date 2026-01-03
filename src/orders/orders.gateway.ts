import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Order } from './entities/order.entity';

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: [
      'http://localhost:19006',
      'http://localhost:3000',
      'http://192.168.1.100:19006',
      /^exp:\/\/.*$/,
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
    ],
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);
  
  // Mapa para gestionar conexiones: userId -> Set de socketIds
  private userSockets = new Map<string, Set<string>>();
  
  // Mapa para gestionar salas de restaurantes: restaurantId -> Set de socketIds
  private restaurantRooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
    
    // Limpiar de mapas de usuarios
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
    
    // Limpiar de salas de restaurantes
    for (const [restaurantId, sockets] of this.restaurantRooms.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.restaurantRooms.delete(restaurantId);
        }
        break;
      }
    }
  }

  @SubscribeMessage('join-restaurant-room')
  handleJoinRestaurantRoom(
    @MessageBody() data: { restaurantId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { restaurantId, userId } = data;
    
    if (!restaurantId) {
      client.emit('error', { message: 'restaurantId es requerido' });
      return;
    }

    // Unirse a la sala del restaurante
    const roomName = `restaurant:${restaurantId}`;
    client.join(roomName);
    
    // Registrar en el mapa de salas de restaurantes
    if (!this.restaurantRooms.has(restaurantId)) {
      this.restaurantRooms.set(restaurantId, new Set());
    }
    this.restaurantRooms.get(restaurantId)!.add(client.id);
    
    // Registrar en el mapa de usuarios
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
    }
    
    this.logger.log(`Cliente ${client.id} se unió a la sala del restaurante ${restaurantId}`);
    client.emit('joined-restaurant-room', { restaurantId, room: roomName });
  }

  @SubscribeMessage('leave-restaurant-room')
  handleLeaveRestaurantRoom(
    @MessageBody() data: { restaurantId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { restaurantId } = data;
    
    if (!restaurantId) {
      client.emit('error', { message: 'restaurantId es requerido' });
      return;
    }

    // Salir de la sala del restaurante
    const roomName = `restaurant:${restaurantId}`;
    client.leave(roomName);
    
    // Limpiar del mapa de salas de restaurantes
    const restaurantSockets = this.restaurantRooms.get(restaurantId);
    if (restaurantSockets) {
      restaurantSockets.delete(client.id);
      if (restaurantSockets.size === 0) {
        this.restaurantRooms.delete(restaurantId);
      }
    }
    
    this.logger.log(`Cliente ${client.id} salió de la sala del restaurante ${restaurantId}`);
    client.emit('left-restaurant-room', { restaurantId });
  }

  /**
   * Notificar a todos los clientes en la sala del restaurante sobre un nuevo pedido
   */
  notifyNewOrder(order: Order) {
    const roomName = `restaurant:${order.restaurantId}`;
    this.logger.log(`Notificando nuevo pedido ${order.numeroOrden} a la sala ${roomName}`);
    
    this.server.to(roomName).emit('new-order', {
      order: {
        id: order.id,
        numeroOrden: order.numeroOrden,
        userId: order.userId,
        restaurantId: order.restaurantId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tarifaServicio: order.tarifaServicio,
        total: order.total,
        comentariosCliente: order.comentariosCliente,
        fechaPedido: order.fechaPedido,
        createdAt: order.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notificar cambio de estado del pedido al usuario específico
   */
  notifyStatusChange(order: Order) {
    this.logger.log(`Notificando cambio de estado del pedido ${order.numeroOrden} al usuario ${order.userId}`);
    
    // Notificar al usuario que hizo el pedido
    const userSockets = this.userSockets.get(order.userId);
    if (userSockets && userSockets.size > 0) {
      const payload = {
        order: {
          id: order.id,
          numeroOrden: order.numeroOrden,
          status: order.status,
          tiempoEstimado: order.tiempoEstimado,
          comentariosRestaurante: order.comentariosRestaurante,
          fechaAceptado: order.fechaAceptado,
          fechaListo: order.fechaListo,
          fechaEntregado: order.fechaEntregado,
          updatedAt: order.updatedAt,
        },
        timestamp: new Date().toISOString(),
      };
      
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit('order-status-changed', payload);
      });
    }
    
    // También notificar a la sala del restaurante
    const roomName = `restaurant:${order.restaurantId}`;
    this.server.to(roomName).emit('order-status-changed', {
      order: {
        id: order.id,
        numeroOrden: order.numeroOrden,
        status: order.status,
        tiempoEstimado: order.tiempoEstimado,
        comentariosRestaurante: order.comentariosRestaurante,
        fechaAceptado: order.fechaAceptado,
        fechaListo: order.fechaListo,
        fechaEntregado: order.fechaEntregado,
        updatedAt: order.updatedAt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast a todos los clientes en la sala de un restaurante
   */
  broadcastToRestaurant(restaurantId: string, event: string, data: any) {
    const roomName = `restaurant:${restaurantId}`;
    this.logger.log(`Broadcasting evento ${event} a la sala ${roomName}`);
    this.server.to(roomName).emit(event, data);
  }
}




