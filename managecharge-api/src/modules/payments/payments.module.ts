import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './entities/index.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { ServicesModule } from '../services/index.js';

/**
 * PaymentsModule
 * 
 * @description Módulo que encapsula toda la funcionalidad
 * relacionada con los Payments (pagos individuales).
 * 
 * Dependencias:
 * - ServicesModule: Para verificar servicios y actualizar montos pagados
 * 
 * Nota: Usamos forwardRef para evitar dependencia circular
 * entre PaymentsModule y ServicesModule
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Payment.name,
        schema: PaymentSchema,
      },
    ]),
    forwardRef(() => ServicesModule),
  ],
  controllers: [
    PaymentsController,
  ],
  providers: [
    PaymentsService,
  ],
  exports: [
    PaymentsService,
  ],
})
export class PaymentsModule {}