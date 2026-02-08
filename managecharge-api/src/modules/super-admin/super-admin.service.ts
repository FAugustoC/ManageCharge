import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { Tenant } from '../tenants/index.js';
import { User } from '../users/index.js';
import { Client } from '../clients/index.js';
import { Service } from '../services/index.js';
import { Payment } from '../payments/index.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { CreateSuperAdminDto, ExportDataDto, ExportType } from './dto/index.js';

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Client.name) private clientModel: Model<Client>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants,
      freeTenants,
      premiumTenants,
      totalUsers,
      totalClients,
      totalServices,
      activeServices,
      totalPayments,
      completedPayments,
      monthlyRevenue,
    ] = await Promise.all([
      this.tenantModel.countDocuments(),
      this.tenantModel.countDocuments({
        'subscription.plan': 'free',
      }),
      this.tenantModel.countDocuments({
        'subscription.plan': 'premium',
      }),
      this.userModel.countDocuments(),
      this.clientModel.countDocuments(),
      this.serviceModel.countDocuments(),
      this.serviceModel.countDocuments({
        status: 'active',
      }),
      this.paymentModel.countDocuments(),
      this.paymentModel.countDocuments({
        status: 'paid',
      }),
      this.calculateMonthlyRevenue(startOfMonth),
    ]);

    const platformFee = monthlyRevenue * 0.05;

    return {
      tenants: {
        total: totalTenants,
        free: freeTenants,
        premium: premiumTenants,
      },
      users: {
        total: totalUsers,
      },
      clients: {
        total: totalClients,
      },
      services: {
        total: totalServices,
        active: activeServices,
        inactive: totalServices - activeServices,
      },
      payments: {
        total: totalPayments,
        completed: completedPayments,
        pending: totalPayments - completedPayments,
      },
      revenue: {
        thisMonth: monthlyRevenue,
        platformFee: platformFee,
      },
    };
  }

  private async calculateMonthlyRevenue(startDate: Date): Promise<number> {
    const result = await this.paymentModel.aggregate([
      {
        $match: {
          paidDate: { $gte: startDate },
          status: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$paidAmount' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  async getAllTenants(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.tenantModel
        .find()
        .select('name businessName email phone subscription createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.tenantModel.countDocuments(),
    ]);

    return {
      data: tenants,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  async getTenantDetails(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId).lean();

    if (!tenant) {
      throw new NotFoundException(
        `Tenant con ID ${tenantId} no encontrado`
      );
    }

    const tenantObjectId = new Types.ObjectId(tenant._id.toString());

    const [clientsCount, servicesCount, paymentsCount, totalRevenue] =
      await Promise.all([
        this.clientModel.countDocuments({ tenantId: tenantObjectId } as any),
        this.serviceModel.countDocuments({ tenantId: tenantObjectId } as any),
        this.paymentModel.countDocuments({ tenantId: tenantObjectId } as any),
        this.calculateTenantRevenue(tenantObjectId),
      ]);

    return {
      tenant,
      stats: {
        clients: clientsCount,
        services: servicesCount,
        payments: paymentsCount,
        totalRevenue,
      },
    };
  }

  private async calculateTenantRevenue(
    tenantId: Types.ObjectId,
  ): Promise<number> {
    const result = await this.paymentModel.aggregate([
      {
        $match: {
          tenantId: tenantId,
          status: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$paidAmount' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  async getTenantClients(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado`);
    }

    const tenantObjectId = new Types.ObjectId(tenant._id.toString());

    const clients = await this.clientModel
      .find({ tenantId: tenantObjectId } as any)
      .select('name email phone company status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return clients;
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  async getTenantServices(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado`);
    }

    const tenantObjectId = new Types.ObjectId(tenant._id.toString());

    const services = await this.serviceModel
      .find({ tenantId: tenantObjectId } as any)
      .populate('clientId', 'name email')
      .select('name description totalAmount status billingType createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return services;
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  async getTenantPayments(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado`);
    }

    const tenantObjectId = new Types.ObjectId(tenant._id.toString());

    const payments = await this.paymentModel
      .find({ tenantId: tenantObjectId } as any)
      .populate('clientId', 'name email')
      .populate('serviceId', 'name')
      .select('amount status paymentMethod dueDate paidDate createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return payments;
  }

  async exportData(exportDto: ExportDataDto) {
    const { tenantId, exportType, startDate, endDate } = exportDto;

    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(
        `Tenant con ID ${tenantId} no encontrado`
      );
    }

    const tenantObjectId = new Types.ObjectId(tenant._id.toString());

    let data: any;

    switch (exportType) {
      case ExportType.PAYMENTS:
        data = await this.exportPayments(tenantObjectId, startDate, endDate);
        break;

      case ExportType.CLIENTS:
        data = await this.exportClients(tenantObjectId);
        break;

      case ExportType.SERVICES:
        data = await this.exportServices(tenantObjectId);
        break;

      case ExportType.FULL_REPORT:
        data = await this.exportFullReport(tenantObjectId, startDate, endDate);
        break;

      default:
        throw new Error('Tipo de exportación no válido');
    }

    return {
      tenantName: tenant.name,
      exportType,
      generatedAt: new Date(),
      data,
    };
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  private async exportPayments(
    tenantId: Types.ObjectId,
    startDate?: string,
    endDate?: string,
  ) {
    const filter: any = { tenantId: tenantId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    return await this.paymentModel
      .find(filter as any)
      .populate('clientId', 'name email')
      .populate('serviceId', 'name')
      .lean();
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  private async exportClients(tenantId: Types.ObjectId) {
    return await this.clientModel.find({ tenantId: tenantId } as any).lean();
  }

  /**
   * ✅ SOLUCIÓN FINAL: Usar as any en el filtro
   */
  private async exportServices(tenantId: Types.ObjectId) {
    return await this.serviceModel
      .find({ tenantId: tenantId } as any)
      .populate('clientId', 'name email')
      .lean();
  }

  private async exportFullReport(
    tenantId: Types.ObjectId,
    startDate?: string,
    endDate?: string,
  ) {
    const [clients, services, payments] = await Promise.all([
      this.exportClients(tenantId),
      this.exportServices(tenantId),
      this.exportPayments(tenantId, startDate, endDate),
    ]);

    return {
      clients,
      services,
      payments,
    };
  }

  async createSuperAdmin(createDto: CreateSuperAdminDto) {
    const existingUser = await this.userModel.findOne({
      email: createDto.email,
    });

    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    const superAdmin = new this.userModel({
      name: createDto.name,
      email: createDto.email,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
    });

    await superAdmin.save();

    const { password, ...result } = superAdmin.toObject();
    return result;
  }
}