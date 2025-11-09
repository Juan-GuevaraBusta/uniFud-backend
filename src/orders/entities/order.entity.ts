import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  ACEPTADO = 'aceptado',
  PREPARANDO = 'preparando',
  LISTO = 'listo',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
}

export interface OrderItem {
  dishId: string;
  dishNombre: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  toppingsSeleccionados?: Array<{
    id: string;
    nombre: string;
    precio: number;
  }>;
  toppingsBaseRemocionados?: Array<{
    id: string;
    nombre: string;
  }>;
  comentarios?: string;
}

@Entity('orders')
@Index(['userId', 'fechaPedido'])
@Index(['restaurantId', 'status', 'fechaPedido'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'numero_orden', length: 20, unique: true })
  numeroOrden: string; // Formato: #ABC-123

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: false })
  restaurantId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDIENTE,
  })
  status: OrderStatus;

  @Column({ type: 'jsonb' })
  items: OrderItem[];

  @Column({ type: 'integer', nullable: false })
  subtotal: number; // En centavos

  @Column({ name: 'tarifa_servicio', type: 'integer', default: 0 })
  tarifaServicio: number; // En centavos (5% del subtotal)

  @Column({ type: 'integer', nullable: false })
  total: number; // En centavos

  @Column({ name: 'comentarios_cliente', type: 'text', nullable: true })
  comentariosCliente?: string;

  @Column({ name: 'comentarios_restaurante', type: 'text', nullable: true })
  comentariosRestaurante?: string;

  @Column({ name: 'tiempo_estimado', type: 'integer', nullable: true })
  tiempoEstimado?: number; // Minutos

  @Column({ name: 'fecha_pedido', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaPedido: Date;

  @Column({ name: 'fecha_aceptado', type: 'timestamp', nullable: true })
  fechaAceptado?: Date;

  @Column({ name: 'fecha_listo', type: 'timestamp', nullable: true })
  fechaListo?: Date;

  @Column({ name: 'fecha_entregado', type: 'timestamp', nullable: true })
  fechaEntregado?: Date;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion?: string;

  // Relaciones
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Restaurant, { eager: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




