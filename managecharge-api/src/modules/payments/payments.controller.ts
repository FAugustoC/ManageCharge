import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto, UpdatePaymentDto, RecordPaymentDto } from './dto/index.js';
import { CurrentUser } from '../../common/index.js';
import { PaymentStatus } from '../../common/index.js';

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
 * PaymentsController
 * 
 * @description Controlador REST para gestionar Payments (pagos individuales).
 * Todos los endpoints requieren autenticación.
 * 
 * Base URL: /api/v1/payments
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments
   * Crear un pago manualmente
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un pago manualmente',
    description: 'Crea un nuevo pago para un servicio. Normalmente los pagos se generan automáticamente.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pago creado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Servicio no encontrado',
  })
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payment = await this.paymentsService.create(
      createPaymentDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Pago creado exitosamente',
      data: payment,
    };
  }

  /**
   * GET /payments
   * Obtener todos los pagos del tenant
   */
  @Get()
  @ApiOperation({
    summary: 'Listar pagos',
    description: 'Obtiene todos los pagos del tenant',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PaymentStatus,
    description: 'Filtrar por estado del pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pagos obtenida exitosamente',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: PaymentStatus,
  ) {
    const payments = await this.paymentsService.findAllByTenant(
      user.tenantId!,
      status,
    );

    return {
      success: true,
      data: payments,
      meta: {
        total: payments.length,
        filter: {
          status: status ?? 'all',
        },
      },
    };
  }

  /**
   * GET /payments/summary
   * Obtener resumen de pagos
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Resumen de pagos',
    description: 'Obtiene un resumen del total de pagos, montos pagados y pendientes',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen obtenido exitosamente',
  })
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    const summary = await this.paymentsService.getPaymentsSummary(user.tenantId!);

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * GET /payments/upcoming
   * Obtener pagos próximos a vencer
   */
  @Get('upcoming')
  @ApiOperation({
    summary: 'Pagos próximos a vencer',
    description: 'Obtiene los pagos que vencen en los próximos días',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Días a futuro para buscar (default: 7)',
    example: 7,
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos próximos obtenidos exitosamente',
  })
  async getUpcoming(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: number,
  ) {
    const daysAhead = days || 7;
    const payments = await this.paymentsService.getUpcomingPayments(
      user.tenantId!,
      daysAhead,
    );

    return {
      success: true,
      data: payments,
      meta: {
        total: payments.length,
        daysAhead,
      },
    };
  }

  /**
   * GET /payments/overdue
   * Obtener pagos vencidos
   */
  @Get('overdue')
  @ApiOperation({
    summary: 'Pagos vencidos',
    description: 'Obtiene todos los pagos que están vencidos',
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos vencidos obtenidos exitosamente',
  })
  async getOverdue(@CurrentUser() user: AuthenticatedUser) {
    const payments = await this.paymentsService.getOverduePayments(user.tenantId!);

    return {
      success: true,
      data: payments,
      meta: {
        total: payments.length,
      },
    };
  }

  /**
 * PATCH /payments/mark-overdue
 * Marcar pagos vencidos
 */
  @Patch('mark-overdue')
  @ApiOperation({
    summary: 'Marcar pagos vencidos',
    description: 'Actualiza el estado de los pagos que pasaron su fecha de vencimiento',
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos actualizados exitosamente',
  })
  async markOverdue(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.paymentsService.markOverduePayments(user.tenantId!);

    return {
      success: true,
      message: `${count} pago(s) marcado(s) como vencido(s)`,
      data: {
        updatedCount: count,
      },
    };
  }

  /**
   * GET /payments/by-service/:serviceId
   * Obtener pagos de un servicio
   */
  @Get('by-service/:serviceId')
  @ApiOperation({
    summary: 'Pagos de un servicio',
    description: 'Obtiene todos los pagos de un servicio específico',
  })
  @ApiParam({
    name: 'serviceId',
    description: 'ID del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos del servicio obtenidos exitosamente',
  })
  async findByService(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payments = await this.paymentsService.findAllByService(
      serviceId,
      user.tenantId!,
    );

    return {
      success: true,
      data: payments,
      meta: {
        total: payments.length,
        serviceId,
      },
    };
  }

  /**
   * GET /payments/by-client/:clientId
   * Obtener pagos de un cliente
   */
  @Get('by-client/:clientId')
  @ApiOperation({
    summary: 'Pagos de un cliente',
    description: 'Obtiene todos los pagos de un cliente específico',
  })
  @ApiParam({
    name: 'clientId',
    description: 'ID del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos del cliente obtenidos exitosamente',
  })
  async findByClient(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payments = await this.paymentsService.findAllByClient(
      clientId,
      user.tenantId!,
    );

    return {
      success: true,
      data: payments,
      meta: {
        total: payments.length,
        clientId,
      },
    };
  }

  /**
   * GET /payments/:id
   * Obtener un pago por ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener pago por ID',
    description: 'Obtiene los detalles de un pago específico',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Pago no encontrado',
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payment = await this.paymentsService.findById(id, user.tenantId!);

    return {
      success: true,
      data: payment,
    };
  }

  /**
 * PATCH /payments/:id/record
 * Registrar un pago recibido
 */
  @Patch(':id/record')
  @ApiOperation({
    summary: 'Registrar pago recibido',
    description: 'Registra que se recibió un pago del cliente',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago registrado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El pago ya fue registrado o está cancelado',
  })
  @ApiResponse({
    status: 404,
    description: 'Pago no encontrado',
  })
  async recordPayment(
    @Param('id') id: string,
    @Body() recordPaymentDto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payment = await this.paymentsService.recordPayment(
      id,
      recordPaymentDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Pago registrado exitosamente',
      data: payment,
    };
  }

  /**
   * PUT /payments/:id
   * Actualizar un pago
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar pago',
    description: 'Actualiza los datos de un pago',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Pago no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payment = await this.paymentsService.update(
      id,
      updatePaymentDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Pago actualizado exitosamente',
      data: payment,
    };
  }

  /**
   * PATCH /payments/:id
   * Actualizar un pago parcialmente
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar pago (parcial)',
    description: 'Actualiza solo los campos enviados',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago actualizado exitosamente',
  })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payment = await this.paymentsService.update(
      id,
      updatePaymentDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Pago actualizado exitosamente',
      data: payment,
    };
  }

  /**
   * PATCH /payments/:id/cancel
   * Cancelar un pago
   */
  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar pago',
    description: 'Cancela un pago pendiente',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago cancelado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede cancelar un pago ya pagado',
  })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payment = await this.paymentsService.cancel(id, user.tenantId!);

    return {
      success: true,
      message: 'Pago cancelado exitosamente',
      data: payment,
    };
  }
}