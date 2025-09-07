import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IsUUID, IsString, IsOptional, IsBoolean } from 'class-validator';

@Entity('payment_methods')
@Index(['customerId'])
@Index(['isDefault'])
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  readonly id: string;

  @Column({ name: 'customer_id' })
  @IsUUID()
  readonly customerId: string;

  @Column({ name: 'gateway_payment_method_id' })
  @IsString()
  gatewayPaymentMethodId: string;

  @Column({ name: 'card_last_four', length: 4, nullable: true })
  @IsOptional()
  @IsString()
  cardLastFour?: string;

  @Column({ name: 'card_brand', nullable: true })
  @IsOptional()
  @IsString()
  cardBrand?: string;

  @Column({ name: 'card_expiry_month', nullable: true })
  @IsOptional()
  cardExpiryMonth?: number;

  @Column({ name: 'card_expiry_year', nullable: true })
  @IsOptional()
  cardExpiryYear?: number;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  @Column({ name: 'is_default', default: false })
  @IsBoolean()
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  readonly createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<PaymentMethod>) {
    Object.assign(this, partial);
  }
}
