// src/modules/webhooks/index.ts

/**
 * Barrel export para el módulo de Webhooks
 *
 * Permite importar todo desde un solo lugar:
 * import { WebhooksModule, WebhooksService } from '@modules/webhooks';
 */
// Módulo principal
export * from './webhooks.module.js';
// Servicio
export * from './webhooks.service.js';
// Controller
export * from './webhooks.controller.js';
// Entidades
export * from './entities/index.js';
