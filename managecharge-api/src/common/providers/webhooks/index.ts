/**
 * Barrel export para los adaptadores de webhooks
 *
 * Para agregar un proveedor nuevo (ej: CyberSource):
 * 1. Crear cybersource-webhook.adapter.ts que implemente IWebhookAdapter
 * 2. Exportarlo aquí
 * 3. Agregarlo a la lista WEBHOOK_ADAPTERS en webhooks.module.ts
 */
export * from './webhook.errors.js';
export * from './stripe-webhook.adapter.js';
