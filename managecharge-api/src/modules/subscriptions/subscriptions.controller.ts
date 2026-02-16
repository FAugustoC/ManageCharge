import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { SubscriptionsService } from './subscriptions.service.js';
import {
  SubscribeDto,
  UpdatePaymentMethodDto,
  CancelSubscriptionDto,
  ManualChargeDto,
} from './dto/index.js';
import {
  CurrentUser,
  SuperAdminGuard,
  Public,
} from '../../common/index.js';
import { JwtAuthGuard } from '../auth/index.js';

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
 * SubscriptionsController
 *
 * @description Endpoints para gestión de suscripciones.
 *
 * Rutas públicas (sin autenticación):
 * - GET /subscriptions/pricing - Precios según país
 *
 * Rutas de tenant (requieren JWT):
 * - GET /subscriptions/plans - Planes disponibles con precios del tenant
 * - GET /subscriptions/current - Suscripción actual del tenant
 * - GET /subscriptions/history - Historial de transacciones
 * - POST /subscriptions/subscribe - Contratar plan premium
 * - POST /subscriptions/payment-method - Actualizar método de pago
 * - POST /subscriptions/cancel - Cancelar suscripción
 *
 * Rutas de super admin:
 * - POST /subscriptions/admin/:tenantId/charge - Cobro manual
 * - GET /subscriptions/admin/stats - Estadísticas generales
 */
@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  // ============================================================
  // RUTAS PÚBLICAS - Sin autenticación
  // ============================================================

  /**
   * GET /subscriptions/pricing
   * Precios según país (para landing page)
   */
  @Get('pricing')
  @Public()    
  @ApiOperation({
    summary: 'Obtener precios de planes por país',
    description:
      'Endpoint público para mostrar precios en la landing page. ' +
      'Detecta la moneda según el código de país ISO.',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Código de país ISO (ej: GT, MX, CO). Default: GT',
    example: 'GT',
  })
  @ApiResponse({
    status: 200,
    description: 'Precios obtenidos exitosamente',
  })
  async getPublicPricing(@Query('country') country?: string) {
    const plans = await this.subscriptionsService.getPublicPlans(
      country || 'GT',
    );

    return {
      success: true,
      data: plans,
    };
  }

  // ============================================================
  // RUTAS DE TENANT - Requieren autenticación
  // ============================================================

  /**
   * GET /subscriptions/plans
   * Planes disponibles con precios del tenant
   */
  @Get('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener planes disponibles',
    description:
      'Retorna los planes con precios en la moneda local del tenant ' +
      'basándose en el país registrado en su perfil.',
  })
  @ApiResponse({
    status: 200,
    description: 'Planes obtenidos exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  async getPlans(@CurrentUser() user: AuthenticatedUser) {
    const plans = await this.subscriptionsService.getPlans(
      user.tenantId!,
    );

    return {
      success: true,
      data: plans,
    };
  }

  /**
   * GET /subscriptions/current
   * Suscripción actual del tenant
   */
  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener suscripción actual',
    description:
      'Retorna el estado completo de la suscripción del tenant, ' +
      'incluyendo días restantes y mensajes informativos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripción obtenida exitosamente',
  })
  async getCurrentSubscription(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const subscription =
      await this.subscriptionsService.getCurrentSubscription(
        user.tenantId!,
      );

    return {
      success: true,
      data: subscription,
    };
  }

  /**
   * GET /subscriptions/history
   * Historial de transacciones del tenant
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Historial de transacciones',
    description: 'Lista paginada de todos los cobros de suscripción.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página actual. Default: 1',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Registros por página. Default: 10',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial obtenido exitosamente',
  })
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const history =
      await this.subscriptionsService.getTransactionHistory(
        user.tenantId!,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 10,
      );

    return {
      success: true,
      data: history.data,
      meta: history.pagination,
    };
  }

  /**
   * POST /subscriptions/subscribe
   * Contratar plan premium
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Contratar suscripción premium',
    description:
      'Activa un plan premium usando el token de pago generado ' +
      'por Stripe.js en el frontend. Nunca se envían datos de tarjeta.',
  })
  @ApiResponse({
    status: 201,
    description: 'Suscripción activada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Cobro rechazado o datos inválidos',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya tiene una suscripción activa',
  })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() subscribeDto: SubscribeDto,
  ) {
    const result = await this.subscriptionsService.subscribe(
      user.tenantId!,
      subscribeDto,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /subscriptions/payment-method
   * Actualizar método de pago
   */
  @Post('payment-method')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar método de pago',
    description:
      'Reemplaza la tarjeta guardada con una nueva. ' +
      'Útil cuando la tarjeta expira o es rechazada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Método de pago actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No tiene suscripción activa con método de pago',
  })
  async updatePaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateDto: UpdatePaymentMethodDto,
  ) {
    const result =
      await this.subscriptionsService.updatePaymentMethod(
        user.tenantId!,
        updateDto,
      );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /subscriptions/cancel
   * Cancelar suscripción
   */
  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar suscripción',
    description:
      'Cancela la renovación automática. ' +
      'El acceso premium se mantiene hasta el fin del periodo pagado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripción cancelada. Acceso hasta fin de periodo.',
  })
  @ApiResponse({
    status: 400,
    description: 'No tiene suscripción premium activa',
  })
  @ApiResponse({
    status: 409,
    description: 'La suscripción ya fue cancelada',
  })
  async cancelSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() cancelDto: CancelSubscriptionDto,
  ) {
    const result =
      await this.subscriptionsService.cancelSubscription(
        user.tenantId!,
        cancelDto,
      );

    return {
      success: true,
      data: result,
    };
  }

  // ============================================================
  // RUTAS DE SUPER ADMIN
  // ============================================================

  /**
   * POST /subscriptions/admin/:tenantId/charge
   * Cobro manual por super admin
   */
  @Post('admin/:tenantId/charge')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cobro manual (Solo Super Admin)',
    description:
      'Ejecuta un cobro manual para un tenant específico. ' +
      'Útil para soporte cuando el tenant actualizó su tarjeta.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'ID del tenant al que se cobrará',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Cobro procesado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Cobro rechazado o tenant sin método de pago',
  })
  async manualCharge(
    @Param('tenantId') tenantId: string,
    @Body() manualChargeDto: ManualChargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.subscriptionsService.manualCharge(
      tenantId,
      manualChargeDto,
      user.userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /subscriptions/admin/stats
   * Estadísticas generales de suscripciones
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estadísticas de suscripciones (Solo Super Admin)',
    description:
      'Retorna conteo de tenants por plan y estado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getStats() {
    const stats =
      await this.subscriptionsService.getSubscriptionStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /subscriptions/admin/grace-period
   * Tenants en grace period
   */
  @Get('admin/grace-period')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Tenants en grace period (Solo Super Admin)',
    description:
      'Lista tenants con suscripción vencida que aún están ' +
      'en el periodo de gracia (intentando cobrar).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista obtenida exitosamente',
  })
  async getGracePeriodTenants() {
    const tenants =
      await this.subscriptionsService.getGracePeriodTenants();

    return {
      success: true,
      data: tenants,
    };
  }
}