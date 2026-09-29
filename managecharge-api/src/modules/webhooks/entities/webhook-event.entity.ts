import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import {
  PaymentProvider,
  WEBHOOK_EVENT_RETENTION_DAYS,
  WebhookEventStatus,
  WebhookEventType,
} from '../../../common/index.js';
import type { NormalizedWebhookData } from '../../../common/index.js';

/**
 * Webhook Event Entity
 *
 * @description Bitácora de cada webhook recibido. Tiene dos propósitos:
 *
 * 1. IDEMPOTENCIA: los proveedores garantizan entregar cada evento
 *    "al menos una vez", lo que significa que A VECES llega dos veces.
 *    El índice único (provider + eventId) hace que MongoDB rechace el
 *    segundo registro, y así sabemos que ya lo vimos. Sin esto, un
 *    reembolso duplicado podría descontarse dos veces.
 *
 * 2. AUDITORÍA: saber qué llegó, cuándo, y si falló por qué.
 *
 * No guarda el cuerpo completo del proveedor (trae datos personales
 * del cliente), solo los datos ya traducidos que necesitamos.
 */
@Schema({ timestamps: true, collection: 'webhook_events' })
export class WebhookEvent {
  @Prop({ required: true, enum: Object.values(PaymentProvider) })
  provider: string;

  /** ID del evento en el proveedor (evt_...) */
  @Prop({ required: true })
  eventId: string;

  /** Nombre original del evento (ej: payment_intent.succeeded) */
  @Prop({ required: true })
  originalType: string;

  /** Tipo traducido; null si no nos interesa */
  @Prop({
    type: String,
    enum: [...Object.values(WebhookEventType), null],
    default: null,
  })
  type: string | null;

  @Prop({
    required: true,
    enum: Object.values(WebhookEventStatus),
    index: true,
  })
  status: string;

  /** Veces que se intentó procesar (sube con cada reintento del proveedor) */
  @Prop({ default: 1 })
  attempts: number;

  @Prop({ required: true })
  livemode: boolean;

  /** Cuándo ocurrió en el proveedor */
  @Prop({ required: true })
  occurredAt: Date;

  /** Cuándo terminamos de procesarlo */
  @Prop()
  processedAt?: Date;

  /** Último error, si falló */
  @Prop()
  lastError?: string;

  /** Datos traducidos del evento */
  @Prop({ type: Object })
  data?: NormalizedWebhookData;

  createdAt?: Date;

  updatedAt?: Date;
}

export type WebhookEventDocument = WebhookEvent & Document;

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// Idempotencia: un mismo evento de un mismo proveedor solo puede existir una vez
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

// Limpieza automática: MongoDB borra los registros viejos por su cuenta (TTL)
WebhookEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 },
);
