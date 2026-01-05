import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  total: number;
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'siigo_invoice_id', nullable: true })
  siigoInvoiceId?: string; // ID de factura en Siigo

  @Column({ name: 'invoice_number' })
  invoiceNumber: string; // Número consecutivo de factura

  @Column({ name: 'invoice_prefix', default: 'FE' })
  invoicePrefix: string; // Prefijo de factura (FE)

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_document' })
  customerDocument: string; // NIT o CC

  @Column({ name: 'customer_document_type', default: 'CC' })
  customerDocumentType: string; // CC, NIT, CE

  @Column({ name: 'customer_email' })
  customerEmail: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number; // IVA

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ name: 'payment_method', default: 'cash' })
  paymentMethod: string; // cash, card, online

  @Column({ type: 'jsonb' })
  items: InvoiceItem[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl?: string; // URL del PDF en Siigo

  @Column({ name: 'xml_url', nullable: true })
  xmlUrl?: string; // URL del XML en Siigo

  @Column({ name: 'status', default: 'pending' })
  status: string; // pending, sent, paid, cancelled, error

  @Column({ name: 'sent_at', nullable: true })
  sentAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

