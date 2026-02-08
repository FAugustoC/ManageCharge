import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/index.js';
import { SuperAdminGuard } from '../../common/guards/index.js';
import { SuperAdminService } from './super-admin.service.js';
import { CreateSuperAdminDto, ExportDataDto } from './dto/index.js';

/**
 * Super Admin Controller
 * 
 * @description Controlador que maneja todos los endpoints exclusivos
 * del super administrador de ManageCharge. Todas las rutas están
 * protegidas por JwtAuthGuard y SuperAdminGuard.
 * 
 * Base URL: /api/v1/super-admin
 */
@ApiTags('Super Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  /**
   * GET /super-admin/dashboard
   * Obtener estadísticas generales de la plataforma
   */
  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard de Super Admin',
    description:
      'Obtiene estadísticas globales de ManageCharge: tenants, usuarios, clientes, servicios, pagos e ingresos',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol Super Admin',
  })
  async getDashboard() {
    const stats = await this.superAdminService.getDashboardStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /super-admin/tenants
   * Listar todos los tenants de la plataforma
   */
  @Get('tenants')
  @ApiOperation({
    summary: 'Listar todos los tenants',
    description: 'Ver todos los workspaces (freelancers/agencias) registrados en ManageCharge',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tenants obtenida exitosamente',
  })
  async getAllTenants(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.superAdminService.getAllTenants(
      Number(page),
      Number(limit),
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * GET /super-admin/tenants/:tenantId/details
   * Ver detalles completos de un tenant específico
   */
  @Get('tenants/:tenantId/details')
  @ApiOperation({
    summary: 'Detalles de un tenant',
    description:
      'Ver información completa de un workspace para propósitos de soporte',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalles del tenant obtenidos exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant no encontrado',
  })
  async getTenantDetails(@Param('tenantId') tenantId: string) {
    const details = await this.superAdminService.getTenantDetails(tenantId);

    return {
      success: true,
      data: details,
    };
  }

  /**
   * GET /super-admin/tenants/:tenantId/clients
   * Ver clientes de un tenant específico
   */
  @Get('tenants/:tenantId/clients')
  @ApiOperation({
    summary: 'Clientes de un tenant',
    description: 'Ver todos los clientes que tiene un tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Clientes obtenidos exitosamente',
  })
  async getTenantClients(@Param('tenantId') tenantId: string) {
    const clients = await this.superAdminService.getTenantClients(tenantId);

    return {
      success: true,
      data: clients,
    };
  }

  /**
   * GET /super-admin/tenants/:tenantId/services
   * Ver servicios de un tenant específico
   */
  @Get('tenants/:tenantId/services')
  @ApiOperation({
    summary: 'Servicios de un tenant',
    description: 'Ver todos los servicios que tiene un tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicios obtenidos exitosamente',
  })
  async getTenantServices(@Param('tenantId') tenantId: string) {
    const services = await this.superAdminService.getTenantServices(tenantId);

    return {
      success: true,
      data: services,
    };
  }

  /**
   * GET /super-admin/tenants/:tenantId/payments
   * Ver historial de pagos de un tenant
   */
  @Get('tenants/:tenantId/payments')
  @ApiOperation({
    summary: 'Pagos de un tenant',
    description: 'Ver historial completo de pagos para propósitos de soporte',
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos obtenidos exitosamente',
  })
  async getTenantPayments(@Param('tenantId') tenantId: string) {
    const payments = await this.superAdminService.getTenantPayments(tenantId);

    return {
      success: true,
      data: payments,
    };
  }

  /**
   * POST /super-admin/export
   * Exportar datos de un tenant
   */
  @Post('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exportar datos',
    description:
      'Genera un reporte con datos del tenant (pagos, clientes, servicios)',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos exportados exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant no encontrado',
  })
  async exportTenantData(@Body() exportDto: ExportDataDto) {
    const data = await this.superAdminService.exportData(exportDto);

    return {
      success: true,
      message: 'Datos exportados exitosamente',
      data,
    };
  }

  /**
   * POST /super-admin/users
   * Crear nuevo Super Admin (para equipo de soporte)
   */
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear Super Admin',
    description:
      'Crear usuario de soporte con acceso super admin (solo para equipo de ManageCharge)',
  })
  @ApiResponse({
    status: 201,
    description: 'Super Admin creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Email ya registrado',
  })
  async createSuperAdmin(@Body() createDto: CreateSuperAdminDto) {
    const admin = await this.superAdminService.createSuperAdmin(createDto);

    return {
      success: true,
      message: 'Super Admin creado exitosamente',
      data: admin,
    };
  }
}