import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './entities/index.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/index.js';
import { 
  BillingType, 
  ServiceStatus,
} from '../../common/index.js';
import { ClientsService } from '../clients/index.js';
import { PaymentsService } from '../payments/payments.service.js';

/**
 * ServicesService
 * 
 * @description Servicio que contiene toda la lógica de negocio
 * relacionada con los Services (contratos/servicios).
 */
@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    private clientsService: ClientsService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
  ) {}

  /**
   * Crear un nuevo Service
   * 
   * @param createServiceDto - Datos validados del nuevo servicio
   * @param tenantId - ID del tenant (desde el token JWT)
   * @param userId - ID del usuario que crea (desde el token JWT)
   * @returns El servicio creado con sus pagos generados
   */
  async create(
    createServiceDto: CreateServiceDto,
    tenantId: string,
    userId: string,
  ): Promise<{ service: ServiceDocument; paymentsGenerated: number }> {
    // Verificar que el cliente existe y pertenece al tenant
    await this.clientsService.findById(createServiceDto.clientId, tenantId);

    // Validar configuración de cuotas
    this.validateInstallmentsConfig(createServiceDto);

    // Crear el nuevo servicio
    const newService = new this.serviceModel({
      ...createServiceDto,
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(createServiceDto.clientId),
      createdBy: new Types.ObjectId(userId),
      startDate: createServiceDto.startDate 
        ? new Date(createServiceDto.startDate) 
        : new Date(),
      endDate: createServiceDto.endDate 
        ? new Date(createServiceDto.endDate) 
        : undefined,
    });

    const savedService = await newService.save();

    // Generar pagos automáticamente
    const payments = await this.paymentsService.generatePaymentsForService(
      savedService,
      tenantId,
    );

    return {
      service: savedService,
      paymentsGenerated: payments.length,
    };
  }

  /**
   * Validar la configuración de cuotas
   */
  private validateInstallmentsConfig(dto: CreateServiceDto): void {
    // Si es tipo INSTALLMENTS, debe tener installmentsCount
    if (dto.billingType === BillingType.INSTALLMENTS) {
      if (!dto.installmentsCount || dto.installmentsCount < 1) {
        throw new BadRequestException(
          'Para pagos en cuotas, debe especificar el número de cuotas (installmentsCount)',
        );
      }

      // Si hay configuración personalizada, validar que sume 100%
      if (dto.installmentsConfig && dto.installmentsConfig.length > 0) {
        // Verificar que la cantidad de configuraciones coincida con el número de cuotas
        if (dto.installmentsConfig.length !== dto.installmentsCount) {
          throw new BadRequestException(
            `La configuración debe tener ${dto.installmentsCount} cuotas, pero se recibieron ${dto.installmentsConfig.length}`,
          );
        }

        // Verificar que los porcentajes sumen 100
        const totalPercentage = dto.installmentsConfig.reduce(
          (sum, config) => sum + config.percentage,
          0,
        );

        if (totalPercentage !== 100) {
          throw new BadRequestException(
            `Los porcentajes deben sumar 100%, pero suman ${totalPercentage}%`,
          );
        }

        // Verificar que los números de cuota sean únicos y consecutivos
        const numbers = dto.installmentsConfig.map(c => c.number).sort((a, b) => a - b);
        for (let i = 0; i < numbers.length; i++) {
          if (numbers[i] !== i + 1) {
            throw new BadRequestException(
              'Los números de cuota deben ser consecutivos empezando desde 1',
            );
          }
        }
      }
    }
  }

  /**
   * Obtener todos los Services de un Tenant
   */
  async findAllByTenant(
    tenantId: string,
    status?: ServiceStatus,
  ): Promise<ServiceDocument[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    if (status) {
      filter.status = status;
    }

    return this.serviceModel
      .find(filter)
      .populate('clientId', 'name email company')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtener todos los Services de un Client
   */
  async findAllByClient(
    clientId: string,
    tenantId: string,
  ): Promise<ServiceDocument[]> {
    // Verificar que el cliente existe y pertenece al tenant
    await this.clientsService.findById(clientId, tenantId);

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(clientId),
      isActive: true,
    };

    return this.serviceModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtener un Service por su ID
   */
  async findById(id: string, tenantId: string): Promise<ServiceDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    };

    const service = await this.serviceModel
      .findOne(filter)
      .populate('clientId', 'name email company phone')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!service) {
      throw new NotFoundException(`Servicio con ID "${id}" no encontrado`);
    }

    return service;
  }

  /**
   * Actualizar un Service
   */
  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    tenantId: string,
  ): Promise<ServiceDocument> {
    // Verificar que el servicio existe y pertenece al tenant
    await this.findById(id, tenantId);

    // Si se actualiza la configuración de cuotas, validar
    if (updateServiceDto.billingType || updateServiceDto.installmentsCount || updateServiceDto.installmentsConfig) {
      const currentService = await this.findById(id, tenantId);
      
      const validationDto = {
        billingType: updateServiceDto.billingType || currentService.billingType,
        installmentsCount: updateServiceDto.installmentsCount || currentService.installmentsCount,
        installmentsConfig: updateServiceDto.installmentsConfig || currentService.installmentsConfig,
      } as CreateServiceDto;

      this.validateInstallmentsConfig(validationDto);
    }

    // Preparar datos para actualizar
    const updateData: Record<string, unknown> = { ...updateServiceDto };
    
    if (updateServiceDto.startDate) {
      updateData.startDate = new Date(updateServiceDto.startDate);
    }
    if (updateServiceDto.endDate) {
      updateData.endDate = new Date(updateServiceDto.endDate);
    }

    const updatedService = await this.serviceModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true },
      )
      .populate('clientId', 'name email company')
      .exec();

    return updatedService!;
  }

  /**
   * Actualizar el monto pagado de un servicio
   */
  async updatePaidAmount(
    id: string,
    tenantId: string,
    paidAmount: number,
  ): Promise<ServiceDocument> {
    const service = await this.findById(id, tenantId);

    // Actualizar monto pagado
    service.paidAmount = paidAmount;

    // Si se pagó todo, marcar como completado
    if (paidAmount >= service.totalAmount) {
      service.status = ServiceStatus.COMPLETED;
    }

    return service.save();
  }

  /**
   * Cambiar estado del servicio
   */
  async changeStatus(
    id: string,
    tenantId: string,
    status: ServiceStatus,
  ): Promise<ServiceDocument> {
    await this.findById(id, tenantId);

    const updatedService = await this.serviceModel
      .findByIdAndUpdate(
        id,
        { status },
        { new: true },
      )
      .exec();

    return updatedService!;
  }

  /**
   * Cancelar un servicio
   */
  async cancel(id: string, tenantId: string): Promise<ServiceDocument> {
    return this.changeStatus(id, tenantId, ServiceStatus.CANCELLED);
  }

  /**
   * Pausar un servicio
   */
  async pause(id: string, tenantId: string): Promise<ServiceDocument> {
    return this.changeStatus(id, tenantId, ServiceStatus.PAUSED);
  }

  /**
   * Reactivar un servicio pausado
   */
  async resume(id: string, tenantId: string): Promise<ServiceDocument> {
    return this.changeStatus(id, tenantId, ServiceStatus.ACTIVE);
  }

  /**
   * Desactivar un Service (soft delete)
   */
  async deactivate(id: string, tenantId: string): Promise<ServiceDocument> {
    await this.findById(id, tenantId);

    const deactivatedService = await this.serviceModel
      .findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      )
      .exec();

    return deactivatedService!;
  }

  /**
   * Reactivar un Service
   */
  async reactivate(id: string, tenantId: string): Promise<ServiceDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    };

    const service = await this.serviceModel.findOne(filter).exec();

    if (!service) {
      throw new NotFoundException(`Servicio con ID "${id}" no encontrado`);
    }

    const reactivatedService = await this.serviceModel
      .findByIdAndUpdate(
        id,
        { isActive: true },
        { new: true },
      )
      .exec();

    return reactivatedService!;
  }

  /**
   * Eliminar un Service permanentemente
   */
  async remove(id: string, tenantId: string): Promise<void> {
    const service = await this.findById(id, tenantId);
    
    // Eliminar los pagos asociados
    await this.paymentsService.removeAllByService(id, tenantId);
    
    await this.serviceModel.findByIdAndDelete(service._id).exec();
  }

  /**
   * Contar servicios de un tenant
   */
  async countByTenant(
    tenantId: string,
    status?: ServiceStatus,
  ): Promise<number> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    if (status) {
      filter.status = status;
    }

    return this.serviceModel.countDocuments(filter).exec();
  }

  /**
   * Contar servicios de un cliente
   */
  async countByClient(clientId: string, tenantId: string): Promise<number> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(clientId),
      isActive: true,
    };

    return this.serviceModel.countDocuments(filter).exec();
  }

  /**
   * Obtener resumen financiero de un tenant
   */
  async getFinancialSummary(tenantId: string): Promise<{
    totalServices: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    byStatus: Record<string, number>;
  }> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    const services = await this.serviceModel.find(filter).exec();

    const summary = {
      totalServices: services.length,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      byStatus: {} as Record<string, number>,
    };

    for (const service of services) {
      summary.totalAmount += service.totalAmount;
      summary.paidAmount += service.paidAmount;
      
      summary.byStatus[service.status] = (summary.byStatus[service.status] || 0) + 1;
    }

    summary.pendingAmount = summary.totalAmount - summary.paidAmount;

    return summary;
  }
}