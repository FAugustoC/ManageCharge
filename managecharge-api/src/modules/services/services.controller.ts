import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ServicesService } from './services.service.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/index.js';
import { CurrentUser } from '../../common/index.js';
import { ServiceStatus } from '../../common/index.js';

/**
 * Interfaz para el usuario autenticado
 */
interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
}

/**
 * ServicesController
 * 
 * @description Controlador REST para gestionar Services (contratos/servicios).
 * Todos los endpoints requieren autenticación y filtran
 * automáticamente por el tenant del usuario autenticado.
 * 
 * Base URL: /api/v1/services
 */
@ApiTags('Services')
@ApiBearerAuth('JWT-auth')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * POST /services
   * Crear un nuevo Service
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo servicio',
    description: 'Registra un nuevo servicio/contrato para un cliente',
  })
  @ApiResponse({
    status: 201,
    description: 'Servicio creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o configuración de cuotas incorrecta',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async create(
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.create(
      createServiceDto,
      user.tenantId!,
      user.userId,
    );

    return {
      success: true,
      message: 'Servicio creado exitosamente',
      data: service,
    };
  }

  /**
   * GET /services
   * Obtener todos los Services del tenant
   */
  @Get()
  @ApiOperation({
    summary: 'Listar servicios',
    description: 'Obtiene todos los servicios del tenant del usuario autenticado',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ServiceStatus,
    description: 'Filtrar por estado del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de servicios obtenida exitosamente',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: ServiceStatus,
  ) {
    const services = await this.servicesService.findAllByTenant(
      user.tenantId!,
      status,
    );

    return {
      success: true,
      message: 'Servicios obtenidos exitosamente',
      data: services,
      meta: {
        total: services.length,
        filter: {
          status: status ?? 'all',
        },
      },
    };
  }

  /**
   * GET /services/summary
   * Obtener resumen financiero
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Resumen financiero',
    description: 'Obtiene un resumen del total facturado, pagado y pendiente',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen obtenido exitosamente',
  })
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    const summary = await this.servicesService.getFinancialSummary(user.tenantId!);

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * GET /services/count
   * Contar servicios del tenant
   */
  @Get('count')
  @ApiOperation({
    summary: 'Contar servicios',
    description: 'Retorna el número de servicios del tenant',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ServiceStatus,
    description: 'Filtrar por estado',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo obtenido exitosamente',
  })
  async count(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: ServiceStatus,
  ) {
    const total = await this.servicesService.countByTenant(
      user.tenantId!,
      status,
    );

    return {
      success: true,
      data: {
        total,
        filter: {
          status: status ?? 'all',
        },
      },
    };
  }

  /**
   * GET /services/by-client/:clientId
   * Obtener servicios de un cliente específico
   */
  @Get('by-client/:clientId')
  @ApiOperation({
    summary: 'Listar servicios de un cliente',
    description: 'Obtiene todos los servicios de un cliente específico',
  })
  @ApiParam({
    name: 'clientId',
    description: 'ID del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicios del cliente obtenidos exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async findByClient(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const services = await this.servicesService.findAllByClient(
      clientId,
      user.tenantId!,
    );

    return {
      success: true,
      data: services,
      meta: {
        total: services.length,
        clientId,
      },
    };
  }

  /**
   * GET /services/:id
   * Obtener un Service por su ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener servicio por ID',
    description: 'Busca un servicio por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Servicio no encontrado',
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.findById(id, user.tenantId!);

    return {
      success: true,
      data: service,
    };
  }

  /**
   * PUT /services/:id
   * Actualizar un Service completamente
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar servicio (completo)',
    description: 'Actualiza todos los datos de un servicio',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Servicio no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.update(
      id,
      updateServiceDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Servicio actualizado exitosamente',
      data: service,
    };
  }

  /**
   * PATCH /services/:id
   * Actualizar un Service parcialmente
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar servicio (parcial)',
    description: 'Actualiza solo los campos enviados',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio actualizado exitosamente',
  })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.update(
      id,
      updateServiceDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Servicio actualizado exitosamente',
      data: service,
    };
  }

  /**
   * PATCH /services/:id/cancel
   * Cancelar un servicio
   */
  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar servicio',
    description: 'Cancela un servicio (no se eliminan los pagos asociados)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio cancelado exitosamente',
  })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.cancel(id, user.tenantId!);

    return {
      success: true,
      message: 'Servicio cancelado exitosamente',
      data: service,
    };
  }

  /**
   * PATCH /services/:id/pause
   * Pausar un servicio
   */
  @Patch(':id/pause')
  @ApiOperation({
    summary: 'Pausar servicio',
    description: 'Pausa temporalmente un servicio',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio pausado exitosamente',
  })
  async pause(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.pause(id, user.tenantId!);

    return {
      success: true,
      message: 'Servicio pausado exitosamente',
      data: service,
    };
  }

  /**
   * PATCH /services/:id/resume
   * Reanudar un servicio pausado
   */
  @Patch(':id/resume')
  @ApiOperation({
    summary: 'Reanudar servicio',
    description: 'Reanuda un servicio previamente pausado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio reanudado exitosamente',
  })
  async resume(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.resume(id, user.tenantId!);

    return {
      success: true,
      message: 'Servicio reanudado exitosamente',
      data: service,
    };
  }

  /**
   * PATCH /services/:id/deactivate
   * Desactivar un Service (soft delete)
   */
  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar servicio',
    description: 'Desactiva un servicio sin eliminarlo (soft delete)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio desactivado exitosamente',
  })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.deactivate(id, user.tenantId!);

    return {
      success: true,
      message: 'Servicio desactivado exitosamente',
      data: service,
    };
  }

  /**
   * PATCH /services/:id/reactivate
   * Reactivar un Service
   */
  @Patch(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivar servicio',
    description: 'Reactiva un servicio previamente desactivado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio reactivado exitosamente',
  })
  async reactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.reactivate(id, user.tenantId!);

    return {
      success: true,
      message: 'Servicio reactivado exitosamente',
      data: service,
    };
  }

  /**
   * DELETE /services/:id
   * Eliminar un Service permanentemente
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar servicio',
    description: 'CUIDADO: Elimina permanentemente un servicio. Esta acción es irreversible.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del servicio',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Servicio no encontrado',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.servicesService.remove(id, user.tenantId!);

    return {
      success: true,
      message: 'Servicio eliminado exitosamente',
    };
  }
}