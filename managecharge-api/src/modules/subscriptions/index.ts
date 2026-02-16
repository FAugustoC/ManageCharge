// src/modules/subscriptions/index.ts

/**
 * Barrel export para el módulo de Subscriptions
 *
 * Permite importar todo desde un solo lugar:
 * import { SubscriptionsModule, SubscriptionsService } from '@modules/subscriptions';
 */
// Módulo principal
export * from './subscriptions.module.js';
// Servicio
export * from './subscriptions.service.js';
// Controller
export * from './subscriptions.controller.js';
// Scheduler
export * from './subscriptions.scheduler.js';
// Entidades
export * from './entities/index.js';
// DTOs
export * from './dto/index.js';