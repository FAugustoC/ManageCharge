import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/index.js';
import { WebhookHandleResult, WebhooksService } from './webhooks.service.js';

/**
 * WebhooksController
 *
 * @description Punto de entrada de los webhooks de los proveedores de pago.
 *
 * URL: POST /api/v1/webhooks/:provider   (ej: /api/v1/webhooks/stripe)
 *
 * - @Public(): el guard global de JWT no aplica aquí. Stripe no envía un
 *   JWT; se identifica con su FIRMA, que verifica el adaptador. La firma
 *   cumple el papel de la autenticación.
 * - @ApiExcludeController(): no aparece en Swagger, porque ninguna
 *   persona debe llamarlo a mano.
 * - @HttpCode(200): Nest responde 201 por defecto en los POST; los
 *   proveedores esperan 200.
 * - No usa @Body() con DTO: la firma se calcula sobre los bytes crudos
 *   (req.rawBody), habilitados con rawBody: true en main.ts.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<WebhookHandleResult> {
    // rawBody solo existe si llegó un cuerpo que Nest sabe leer (JSON)
    if (!req.rawBody) {
      throw new BadRequestException('El webhook no trae cuerpo');
    }

    return this.webhooksService.handle(provider, {
      rawBody: req.rawBody,
      headers: req.headers,
    });
  }
}
