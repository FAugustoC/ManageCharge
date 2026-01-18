import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from './entities/index.js';
import { CreatePaymentDto, UpdatePaymentDto, RecordPaymentDto } from './dto/index.js';
import { PaymentStatus, BillingType } from '../../common/index.js';
import { ServicesService, ServiceDocument } from '../services/index.js';

/**
 * PaymentsService
 * 
 * @description Servicio que contiene toda la lógica de negocio
 * relacionada con los Payments (pagos individuales).
 * 
 * Responsabilidades:
 * - Generar pagos automáticamente al crear un servicio
 * - Registrar pagos recibidos
 * - Actualizar estado de pagos (vencidos, etc.)
 * - Actualizar el servicio cuando se completan pagos
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @Inject(forwardRef(() => ServicesService))
    private servicesService: ServicesService,
  ) {}

  /**
   * Generar pagos automáticamente para un servicio
   * 
   * @description Este método se llama cuando se crea un servicio
   * con tipo de facturación INSTALLMENTS o ONE_TIME
   */
  async generatePaymentsForService(
    service: ServiceDocument,
    tenantId: string,
  ): Promise<PaymentDocument[]> {
    const payments: PaymentDocument[] = [];

    if (service.billingType === BillingType.ONE_TIME) {
      // Pago único
      const payment = new this.paymentModel({
        tenantId: new Types.ObjectId(tenantId),
        serviceId: service._id,
        clientId: service.clientId,
        paymentNumber: 1,
        description: `Pago único - ${service.name}`,
        amount: service.totalAmount,
        percentage: 100,
        currency: service.currency,
        status: PaymentStatus.PENDING,
        dueDate: service.startDate,
      });

      const savedPayment = await payment.save();
      payments.push(savedPayment);

    } else if (service.billingType === BillingType.INSTALLMENTS) {
      // Pagos en cuotas
      const installmentsCount = service.installmentsCount || 1;
      const hasCustomConfig = service.installmentsConfig && service.installmentsConfig.length > 0;

      for (let i = 0; i < installmentsCount; i++) {
        let amount: number;
        let percentage: number;
        let dueDate: Date;

        if (hasCustomConfig && service.installmentsConfig![i]) {
          // Configuración personalizada
          const config = service.installmentsConfig![i];
          percentage = config.percentage;
          amount = Math.round((service.totalAmount * percentage / 100) * 100) / 100;
          dueDate = config.dueDate ? new Date(config.dueDate) : this.calculateDueDate(service.startDate, i);
        } else {
          // Cuotas iguales
          percentage = Math.round((100 / installmentsCount) * 100) / 100;
          amount = Math.round((service.totalAmount / installmentsCount) * 100) / 100;
          dueDate = this.calculateDueDate(service.startDate, i);
        }

        const payment = new this.paymentModel({
          tenantId: new Types.ObjectId(tenantId),
          serviceId: service._id,
          clientId: service.clientId,
          paymentNumber: i + 1,
          description: `Cuota ${i + 1} de ${installmentsCount} - ${service.name}`,
          amount,
          percentage,
          currency: service.currency,
          status: PaymentStatus.PENDING,
          dueDate,
        });

        const savedPayment = await payment.save();
        payments.push(savedPayment);
      }
    }

    return payments;
  }

  /**
   * Calcular fecha de vencimiento basada en el número de cuota
   */
  private calculateDueDate(startDate: Date, monthsToAdd: number): Date {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + monthsToAdd);
    return date;
  }

  /**
   * Crear un pago manualmente
   */
  async create(
    createPaymentDto: CreatePaymentDto,
    tenantId: string,
  ): Promise<PaymentDocument> {
    // Verificar que el servicio existe y pertenece al tenant
    const service = await this.servicesService.findById(
      createPaymentDto.serviceId,
      tenantId,
    );

    const newPayment = new this.paymentModel({
      ...createPaymentDto,
      tenantId: new Types.ObjectId(tenantId),
      serviceId: new Types.ObjectId(createPaymentDto.serviceId),
      clientId: service.clientId,
      currency: service.currency,
      dueDate: new Date(createPaymentDto.dueDate),
      status: PaymentStatus.PENDING,
    });

    return newPayment.save();
  }

  /**
   * Obtener todos los pagos de un tenant
   */
  async findAllByTenant(
    tenantId: string,
    status?: PaymentStatus,
  ): Promise<PaymentDocument[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    if (status) {
      filter.status = status;
    }

    return this.paymentModel
      .find(filter)
      .populate('serviceId', 'name totalAmount')
      .populate('clientId', 'name email company')
      .sort({ dueDate: 1 })
      .exec();
  }

  /**
   * Obtener todos los pagos de un servicio
   */
  async findAllByService(
    serviceId: string,
    tenantId: string,
  ): Promise<PaymentDocument[]> {
    // Verificar que el servicio existe y pertenece al tenant
    await this.servicesService.findById(serviceId, tenantId);

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      serviceId: new Types.ObjectId(serviceId),
      isActive: true,
    };

    return this.paymentModel
      .find(filter)
      .sort({ paymentNumber: 1 })
      .exec();
  }

  /**
   * Obtener todos los pagos de un cliente
   */
  async findAllByClient(
    clientId: string,
    tenantId: string,
  ): Promise<PaymentDocument[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(clientId),
      isActive: true,
    };

    return this.paymentModel
      .find(filter)
      .populate('serviceId', 'name totalAmount')
      .sort({ dueDate: 1 })
      .exec();
  }

  /**
   * Obtener un pago por su ID (sin populate para operaciones internas)
   */
  private async findByIdRaw(id: string, tenantId: string): Promise<PaymentDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    };

    const payment = await this.paymentModel.findOne(filter).exec();

    if (!payment) {
      throw new NotFoundException(`Pago con ID "${id}" no encontrado`);
    }

    return payment;
  }

  /**
   * Obtener un pago por su ID (con populate para respuestas al cliente)
   */
  async findById(id: string, tenantId: string): Promise<PaymentDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    };

    const payment = await this.paymentModel
      .findOne(filter)
      .populate('serviceId', 'name totalAmount billingType')
      .populate('clientId', 'name email company phone')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Pago con ID "${id}" no encontrado`);
    }

    return payment;
  }

  /**
   * Registrar un pago (marcar como pagado)
   */
  async recordPayment(
    id: string,
    recordPaymentDto: RecordPaymentDto,
    tenantId: string,
  ): Promise<PaymentDocument> {
    // Usar findByIdRaw para obtener el serviceId como ObjectId puro
    const payment = await this.findByIdRaw(id, tenantId);

    // Validar que el pago no esté ya pagado completamente
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Este pago ya fue registrado como pagado');
    }

    // Validar que el pago no esté cancelado
    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException('No se puede registrar un pago cancelado');
    }

    // Guardar el serviceId antes de cualquier operación
    const serviceIdString = payment.serviceId.toString();

    // Actualizar el pago
    const newPaidAmount = payment.paidAmount + recordPaymentDto.paidAmount;
    const isPaidInFull = newPaidAmount >= payment.amount;

    const updateData: Record<string, unknown> = {
      paidAmount: newPaidAmount,
      paidDate: recordPaymentDto.paidDate 
        ? new Date(recordPaymentDto.paidDate) 
        : new Date(),
      status: isPaidInFull ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
    };

    if (recordPaymentDto.paymentMethod) {
      updateData.paymentMethod = recordPaymentDto.paymentMethod;
    }

    if (recordPaymentDto.referenceNumber) {
      updateData.referenceNumber = recordPaymentDto.referenceNumber;
    }

    if (recordPaymentDto.notes) {
      updateData.notes = recordPaymentDto.notes;
    }

    const updatedPayment = await this.paymentModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    // Actualizar el monto pagado del servicio
    await this.updateServicePaidAmount(serviceIdString, tenantId);

    return updatedPayment!;
  }

  /**
   * Actualizar el monto pagado total del servicio
   */
  private async updateServicePaidAmount(
    serviceId: string,
    tenantId: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      serviceId: new Types.ObjectId(serviceId),
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    const payments = await this.paymentModel.find(filter).exec();

    const totalPaid = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);

    await this.servicesService.updatePaidAmount(serviceId, tenantId, totalPaid);
  }

  /**
   * Actualizar un pago
   */
  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    tenantId: string,
  ): Promise<PaymentDocument> {
    await this.findByIdRaw(id, tenantId);

    const updateData: Record<string, unknown> = { ...updatePaymentDto };

    if (updatePaymentDto.dueDate) {
      updateData.dueDate = new Date(updatePaymentDto.dueDate);
    }

    const updatedPayment = await this.paymentModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    return updatedPayment!;
  }

  /**
   * Cancelar un pago
   */
  async cancel(id: string, tenantId: string): Promise<PaymentDocument> {
    const payment = await this.findByIdRaw(id, tenantId);

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException(
        'No se puede cancelar un pago que ya fue registrado como pagado',
      );
    }

    const updatedPayment = await this.paymentModel
      .findByIdAndUpdate(
        id,
        { status: PaymentStatus.CANCELLED },
        { new: true },
      )
      .exec();

    return updatedPayment!;
  }

  /**
   * Marcar pagos vencidos
   * 
   * @description Este método debería ejecutarse periódicamente
   * (por ejemplo, con un cron job) para actualizar el estado
   * de los pagos que han pasado su fecha de vencimiento.
   */
  async markOverduePayments(tenantId: string): Promise<number> {
    const now = new Date();

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      status: { $in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
      dueDate: { $lt: now },
      isActive: true,
    };

    const result = await this.paymentModel
      .updateMany(filter, { status: PaymentStatus.OVERDUE })
      .exec();

    return result.modifiedCount;
  }

  /**
   * Obtener pagos próximos a vencer
   */
  async getUpcomingPayments(
    tenantId: string,
    daysAhead: number = 7,
  ): Promise<PaymentDocument[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      status: PaymentStatus.PENDING,
      dueDate: { $gte: now, $lte: futureDate },
      isActive: true,
    };

    return this.paymentModel
      .find(filter)
      .populate('serviceId', 'name')
      .populate('clientId', 'name email')
      .sort({ dueDate: 1 })
      .exec();
  }

  /**
   * Obtener pagos vencidos
   */
  async getOverduePayments(tenantId: string): Promise<PaymentDocument[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      status: PaymentStatus.OVERDUE,
      isActive: true,
    };

    return this.paymentModel
      .find(filter)
      .populate('serviceId', 'name')
      .populate('clientId', 'name email phone')
      .sort({ dueDate: 1 })
      .exec();
  }

  /**
   * Obtener resumen de pagos de un tenant
   */
  async getPaymentsSummary(tenantId: string): Promise<{
    totalPayments: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    byStatus: Record<string, { count: number; amount: number }>;
  }> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    const payments = await this.paymentModel.find(filter).exec();

    const summary = {
      totalPayments: payments.length,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      byStatus: {} as Record<string, { count: number; amount: number }>,
    };

    for (const payment of payments) {
      summary.totalAmount += payment.amount;

      // Inicializar contador de estado si no existe
      if (!summary.byStatus[payment.status]) {
        summary.byStatus[payment.status] = { count: 0, amount: 0 };
      }

      summary.byStatus[payment.status].count++;
      summary.byStatus[payment.status].amount += payment.amount;

      // Calcular montos por categoría
      if (payment.status === PaymentStatus.PAID) {
        summary.paidAmount += payment.paidAmount;
      } else if (payment.status === PaymentStatus.OVERDUE) {
        summary.overdueAmount += payment.amount - payment.paidAmount;
        summary.pendingAmount += payment.amount - payment.paidAmount;
      } else if (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.PARTIAL) {
        summary.pendingAmount += payment.amount - payment.paidAmount;
      }
    }

    return summary;
  }

  /**
   * Eliminar todos los pagos de un servicio
   * 
   * @description Se usa cuando se elimina un servicio
   */
  async removeAllByService(serviceId: string, tenantId: string): Promise<void> {
    const filter: Record<string, unknown> = {
      serviceId: new Types.ObjectId(serviceId),
      tenantId: new Types.ObjectId(tenantId),
    };

    await this.paymentModel.deleteMany(filter).exec();
  }

  /**
   * Contar pagos por estado
   */
  async countByStatus(
    tenantId: string,
    status: PaymentStatus,
  ): Promise<number> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      status,
      isActive: true,
    };

    return this.paymentModel.countDocuments(filter).exec();
  }
}