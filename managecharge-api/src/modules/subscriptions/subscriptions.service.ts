import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';

// Entities
import { Tenant, TenantDocument } from '../tenants/index.js';
import {
    SubscriptionTransaction,
    SubscriptionTransactionDocument,
} from './entities/index.js';

// DTOs
import {
    SubscribeDto,
    UpdatePaymentMethodDto,
    CancelSubscriptionDto,
    ManualChargeDto,
} from './dto/index.js';

// Enums
import {
    SubscriptionPlan,
    SubscriptionStatus,
    TransactionType,
    TransactionStatus,
    PaymentProvider,
} from '../../common/enums/index.js';

// Constants
import {
    SUBSCRIPTION_FEATURES,
    SUBSCRIPTION_RETRY_CONFIG,
    getSubscriptionPrice,
} from '../../common/constants/index.js';

// Providers
import { StripeProvider } from '../../common/providers/payment/index.js';

/**
 * SubscriptionsService
 *
 * @description Servicio principal para gestión de suscripciones.
 *
 * Responsabilidades:
 * - Contratar planes premium
 * - Gestionar métodos de pago
 * - Procesar renovaciones automáticas
 * - Manejar cancelaciones
 * - Registrar todas las transacciones
 */
@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        @InjectModel(Tenant.name)
        private readonly tenantModel: Model<TenantDocument>,

        @InjectModel(SubscriptionTransaction.name)
        private readonly transactionModel: Model<SubscriptionTransactionDocument>,

        private readonly stripeProvider: StripeProvider,
        private readonly configService: ConfigService,
    ) { }

    // ============================================================
    // MÉTODOS PÚBLICOS - Endpoints del tenant
    // ============================================================

    /**
     * Obtener planes disponibles con precios según país del tenant
     *
     * @param tenantId - ID del tenant autenticado
     * @returns Planes con precios en moneda local
     */
    async getPlans(tenantId: string) {
        const tenant = await this.findTenantOrFail(tenantId);

        // Detectar país del tenant
        const country = tenant.address?.country || 'GT';

        // Calcular precios en moneda local
        const monthlyPricing = getSubscriptionPrice('monthly', country);
        const annualPricing = getSubscriptionPrice('annual', country);
        const annualMonthlyEquivalent = {
            amount: Math.round((annualPricing.amount / 12) * 100) / 100,
            currency: annualPricing.currency,
            symbol: annualPricing.symbol,
        };

        return {
            currentPlan: tenant.subscription?.plan || SubscriptionPlan.FREE,
            currentStatus: tenant.subscription?.status || SubscriptionStatus.ACTIVE,
            country,
            plans: {
                [SubscriptionPlan.FREE]: {
                    id: SubscriptionPlan.FREE,
                    name: 'Free',
                    description: 'Plan gratuito con funciones básicas',
                    price: 0,
                    currency: monthlyPricing.currency,
                    symbol: monthlyPricing.symbol,
                    interval: null,
                    features: SUBSCRIPTION_FEATURES.FREE,
                },
                [SubscriptionPlan.PREMIUM_MONTHLY]: {
                    id: SubscriptionPlan.PREMIUM_MONTHLY,
                    name: 'Premium Mensual',
                    description: 'Acceso completo con pago mensual',
                    price: monthlyPricing.amount,
                    currency: monthlyPricing.currency,
                    symbol: monthlyPricing.symbol,
                    interval: 'month',
                    features: SUBSCRIPTION_FEATURES.PREMIUM_MONTHLY,
                },
                [SubscriptionPlan.PREMIUM_ANNUAL]: {
                    id: SubscriptionPlan.PREMIUM_ANNUAL,
                    name: 'Premium Anual',
                    description: 'Acceso completo con 23% de descuento',
                    price: annualPricing.amount,
                    pricePerMonth: annualMonthlyEquivalent.amount,
                    currency: annualPricing.currency,
                    symbol: annualPricing.symbol,
                    interval: 'year',
                    discountPercent: 23,
                    features: SUBSCRIPTION_FEATURES.PREMIUM_ANNUAL,
                    popular: true,
                },
            },
        };
    }

    /**
     * Obtener planes disponibles públicamente (sin autenticación)
     * Para mostrar en landing page con detección por país
     *
     * @param country - Código de país ISO (ej: 'GT', 'MX')
     * @returns Planes con precios en moneda local
     */
    async getPublicPlans(country: string = 'GT') {
        const monthlyPricing = getSubscriptionPrice('monthly', country);
        const annualPricing = getSubscriptionPrice('annual', country);
        const annualMonthlyEquivalent = {
            amount: Math.round((annualPricing.amount / 12) * 100) / 100,
            currency: annualPricing.currency,
            symbol: annualPricing.symbol,
        };

        return {
            country,
            plans: {
                [SubscriptionPlan.FREE]: {
                    id: SubscriptionPlan.FREE,
                    name: 'Free',
                    description: 'Perfecto para empezar',
                    price: 0,
                    currency: monthlyPricing.currency,
                    symbol: monthlyPricing.symbol,
                    interval: null,
                    features: SUBSCRIPTION_FEATURES.FREE,
                },
                [SubscriptionPlan.PREMIUM_MONTHLY]: {
                    id: SubscriptionPlan.PREMIUM_MONTHLY,
                    name: 'Premium Mensual',
                    description: 'Ideal para negocios en crecimiento',
                    price: monthlyPricing.amount,
                    currency: monthlyPricing.currency,
                    symbol: monthlyPricing.symbol,
                    displayPrice: `${monthlyPricing.symbol}${monthlyPricing.amount}/${this.getIntervalLabel('month', monthlyPricing.currency)}`,
                    interval: 'month',
                    features: SUBSCRIPTION_FEATURES.PREMIUM_MONTHLY,
                },
                [SubscriptionPlan.PREMIUM_ANNUAL]: {
                    id: SubscriptionPlan.PREMIUM_ANNUAL,
                    name: 'Premium Anual',
                    description: 'Mejor valor - Ahorra 23%',
                    price: annualPricing.amount,
                    pricePerMonth: annualMonthlyEquivalent.amount,
                    currency: annualPricing.currency,
                    symbol: annualPricing.symbol,
                    displayPrice: `${annualPricing.symbol}${annualPricing.amount}/${this.getIntervalLabel('year', annualPricing.currency)}`,
                    displayPricePerMonth: `${annualMonthlyEquivalent.symbol}${annualMonthlyEquivalent.amount}/mes`,
                    interval: 'year',
                    discountPercent: 23,
                    features: SUBSCRIPTION_FEATURES.PREMIUM_ANNUAL,
                    popular: true,
                },
            },
        };
    }

    /**
     * Obtener suscripción actual del tenant
     *
     * @param tenantId - ID del tenant autenticado
     * @returns Información completa de suscripción actual
     */
    async getCurrentSubscription(tenantId: string) {
        const tenant = await this.findTenantOrFail(tenantId);
        const subscription = tenant.subscription;

        // Calcular días restantes del periodo
        const now = new Date();
        const periodEnd = new Date(subscription.currentPeriodEnd);
        const daysRemaining = Math.max(
            0,
            Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );

        // Verificar si está cancelada pero aún activa
        const isCancelledButActive =
            subscription.status === SubscriptionStatus.CANCELLED &&
            now < periodEnd;

        return {
            plan: subscription.plan,
            status: subscription.status,
            isActive: subscription.status === SubscriptionStatus.ACTIVE || isCancelledButActive,
            isPremium: subscription.plan !== SubscriptionPlan.FREE,
            isCancelledButActive,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            daysRemaining,
            autoRenew: subscription.autoRenew,
            amount: subscription.amount,
            currency: subscription.currency,
            // Info del método de pago (sin datos sensibles)
            paymentMethod: subscription.paymentMethod
                ? {
                    provider: subscription.paymentMethod.provider,
                    last4: subscription.paymentMethod.last4,
                    brand: subscription.paymentMethod.brand,
                    expiryMonth: subscription.paymentMethod.expiryMonth,
                    expiryYear: subscription.paymentMethod.expiryYear,
                }
                : null,
            // Mensajes informativos al usuario
            messages: this.buildStatusMessages(
                subscription,
                daysRemaining,
                isCancelledButActive,
                periodEnd,
            ),
        };
    }

    /**
     * Contratar suscripción premium
     *
     * @param tenantId - ID del tenant autenticado
     * @param subscribeDto - Plan y token de pago
     * @returns Confirmación de suscripción
     */
    async subscribe(tenantId: string, subscribeDto: SubscribeDto) {
        const { plan, paymentMethodToken } = subscribeDto;
        const tenant = await this.findTenantOrFail(tenantId);

        // Verificar que no tenga ya un plan premium activo
        if (
            tenant.subscription?.plan !== SubscriptionPlan.FREE &&
            tenant.subscription?.status === SubscriptionStatus.ACTIVE
        ) {
            throw new ConflictException(
                'Ya tienes una suscripción premium activa. ' +
                'Para cambiar de plan, primero cancela tu suscripción actual.',
            );
        }

        // Calcular precio según país del tenant
        const country = tenant.address?.country || 'GT';
        const intervalType = plan === SubscriptionPlan.PREMIUM_ANNUAL
            ? 'annual'
            : 'monthly';
        const pricing = getSubscriptionPrice(intervalType, country);

        this.logger.log(
            `Procesando suscripción ${plan} para tenant ${tenantId} - ${pricing.amount} ${pricing.currency}`,
        );

        // Crear o recuperar customer en Stripe
        let customerId = tenant.subscription?.paymentMethod?.customerId;

        if (!customerId) {
            customerId = await this.stripeProvider.createCustomer({
                email: tenant.email,
                name: tenant.name,
                phone: tenant.phone,
                address: tenant.address ? {
                    line1: tenant.address.street,
                    city: tenant.address.city,
                    state: tenant.address.state,
                    postalCode: tenant.address.postalCode,
                    country: tenant.address.country,
                } : undefined,
                metadata: {
                    tenantId: tenantId,
                    slug: tenant.slug,
                    companyName: tenant.companyName,
                },
            });
        }

        //  Guardar método de pago con try-catch
        let paymentMethodInfo: any;
        try {
            paymentMethodInfo = await this.stripeProvider.savePaymentMethod({
                customerId,
                paymentMethodToken,
            });
        } catch (error) {
            // Registrar transacción fallida
            await this.createTransaction({
                tenantId,
                type: TransactionType.INITIAL,
                plan,
                amount: pricing.amount,
                currency: pricing.currency,
                status: TransactionStatus.FAILED,
                provider: 'stripe',
                providerCustomerId: customerId,
                errorCode: 'card_declined',
                errorMessage: error.message || 'Error al guardar método de pago',
                metadata: { initiatedBy: 'system' },
            });

            this.logger.error(
                `Error al guardar método de pago para tenant ${tenantId}`,
                error.stack,
            );

            // IMPORTANTE: Lanzar BadRequestException (400)
            throw new BadRequestException(
                `No pudimos guardar tu método de pago: ${error.message}. ` +
                'Por favor verifica los datos de tu tarjeta.',
            );
        }

        if (
            !paymentMethodInfo.provider ||
            !Object.values(PaymentProvider).includes(
                paymentMethodInfo.provider as PaymentProvider,
            )
        ) {
            this.logger.error(
                `Provider no soportado: ${paymentMethodInfo.provider}`,
            );

            throw new BadRequestException(
                `El proveedor de pago "${paymentMethodInfo.provider}" no está soportado. ` +
                'Por favor contacta a soporte.',
            );
        }

        this.logger.log(
            `Provider validado: ${paymentMethodInfo.provider}`,
        );

        // Intentar cobro inicial
        const chargeResult = await this.stripeProvider.charge({
            customerId,
            paymentMethodId: paymentMethodInfo.paymentMethodId,
            amount: pricing.amount,
            currency: pricing.currency,
            description: `ManageCharge - ${plan === SubscriptionPlan.PREMIUM_MONTHLY ? 'Premium Mensual' : 'Premium Anual'}`,
            metadata: {
                tenantId,
                plan,
                type: 'initial',
            },
        });

        // Si el cobro falla, no activar la suscripción
        if (!chargeResult.success) {
            // Registrar transacción fallida
            await this.createTransaction({
                tenantId,
                type: TransactionType.INITIAL,
                plan,
                amount: pricing.amount,
                currency: pricing.currency,
                status: TransactionStatus.FAILED,
                provider: 'stripe',
                providerCustomerId: customerId,
                errorCode: chargeResult.errorCode,
                errorMessage: chargeResult.errorMessage,
                metadata: { initiatedBy: 'system' },
            });

            throw new BadRequestException(
                `El cobro fue rechazado: ${chargeResult.errorMessage}. ` +
                'Por favor verifica tu método de pago.',
            );
        }

        // Calcular fechas del periodo
        const now = new Date();
        const periodEnd = this.calculatePeriodEnd(plan, now);

        // Guardar historial anterior si existía
        const previousHistory = tenant.subscription?.subscriptionHistory || [];
        if (tenant.subscription?.plan !== SubscriptionPlan.FREE) {
            previousHistory.push({
                plan: tenant.subscription.plan,
                startDate: tenant.subscription.startDate,
                endDate: now,
                status: 'completed',
                reason: 'upgraded',
            });
        }

        // Actualizar tenant con nueva suscripción
        await this.tenantModel.findByIdAndUpdate(
            tenantId,
            {
                $set: {
                    subscription: {
                        plan,
                        status: SubscriptionStatus.ACTIVE,
                        startDate: now,
                        currentPeriodStart: now,
                        currentPeriodEnd: periodEnd,
                        amount: pricing.amount,
                        currency: pricing.currency,
                        autoRenew: true,
                        retryAttempts: 0,
                        maxRetryAttempts: SUBSCRIPTION_RETRY_CONFIG.MAX_ATTEMPTS,
                        paymentMethod: {
                            provider: 'stripe',
                            customerId,
                            paymentMethodId: paymentMethodInfo.paymentMethodId,
                            last4: paymentMethodInfo.last4,
                            brand: paymentMethodInfo.brand,
                            expiryMonth: paymentMethodInfo.expiryMonth,
                            expiryYear: paymentMethodInfo.expiryYear,
                        },
                        subscriptionHistory: previousHistory,
                    },
                },
            },
            { new: true },
        );

        // Registrar transacción exitosa
        await this.createTransaction({
            tenantId,
            type: TransactionType.INITIAL,
            plan,
            amount: pricing.amount,
            currency: pricing.currency,
            status: TransactionStatus.SUCCESS,
            provider: 'stripe',
            providerTransactionId: chargeResult.transactionId,
            providerCustomerId: customerId,
            metadata: { initiatedBy: 'system' },
        });

        this.logger.log(
            `Suscripción ${plan} activada para tenant ${tenantId}`,
        );

        return {
            success: true,
            plan,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: periodEnd,
            amount: pricing.amount,
            currency: pricing.currency,
            message: `¡Suscripción ${plan === SubscriptionPlan.PREMIUM_MONTHLY ? 'mensual' : 'anual'} activada exitosamente! Acceso premium hasta ${periodEnd.toLocaleDateString()}`,
        };
    }

    /**
     * Actualizar método de pago
     *
     * @param tenantId - ID del tenant autenticado
     * @param updateDto - Token del nuevo método de pago
     * @returns Confirmación de actualización
     */
    async updatePaymentMethod(
        tenantId: string,
        updateDto: UpdatePaymentMethodDto,
    ) {
        const tenant = await this.findTenantOrFail(tenantId);

        if (!tenant.subscription?.paymentMethod?.customerId) {
            throw new BadRequestException(
                'No tienes una suscripción activa con método de pago guardado.',
            );
        }

        const { customerId, paymentMethodId: oldPaymentMethodId } =
            tenant.subscription.paymentMethod;

        this.logger.log(
            `Actualizando método de pago para tenant ${tenantId}`,
        );

        // Guardar nuevo método de pago
        const newPaymentMethodInfo = await this.stripeProvider.savePaymentMethod({
            customerId,
            paymentMethodToken: updateDto.paymentMethodToken,
        });

        // Desvincular método anterior si existe
        if (oldPaymentMethodId) {
            try {
                await this.stripeProvider.detachPaymentMethod(
                    customerId,
                    oldPaymentMethodId,
                );
            } catch (error) {
                // No es crítico si falla, continuamos con el nuevo
                this.logger.warn(
                    `No se pudo desvincular método anterior: ${error.message}`,
                );
            }
        }

        // Actualizar en la base de datos
        await this.tenantModel.findByIdAndUpdate(
            tenantId,
            {
                $set: {
                    'subscription.paymentMethod.paymentMethodId':
                        newPaymentMethodInfo.paymentMethodId,
                    'subscription.paymentMethod.last4': newPaymentMethodInfo.last4,
                    'subscription.paymentMethod.brand': newPaymentMethodInfo.brand,
                    'subscription.paymentMethod.expiryMonth':
                        newPaymentMethodInfo.expiryMonth,
                    'subscription.paymentMethod.expiryYear':
                        newPaymentMethodInfo.expiryYear,
                },
            },
            { new: true },
        );

        this.logger.log(
            `Método de pago actualizado para tenant ${tenantId}`,
        );

        return {
            success: true,
            last4: newPaymentMethodInfo.last4,
            brand: newPaymentMethodInfo.brand,
            expiryMonth: newPaymentMethodInfo.expiryMonth,
            expiryYear: newPaymentMethodInfo.expiryYear,
            message: 'Método de pago actualizado exitosamente',
        };
    }

    /**
     * Cancelar suscripción
     * Mantiene acceso premium hasta fin del periodo pagado
     *
     * @param tenantId - ID del tenant autenticado
     * @param cancelDto - Razón de cancelación (opcional)
     * @returns Confirmación con fecha de fin de acceso
     */
    async cancelSubscription(
        tenantId: string,
        cancelDto: CancelSubscriptionDto,
    ) {
        const tenant = await this.findTenantOrFail(tenantId);

        // Verificar que tiene suscripción activa
        if (tenant.subscription?.plan === SubscriptionPlan.FREE) {
            throw new BadRequestException(
                'No tienes una suscripción premium activa para cancelar.',
            );
        }

        if (tenant.subscription?.status === SubscriptionStatus.CANCELLED) {
            throw new ConflictException(
                'Tu suscripción ya fue cancelada previamente.',
            );
        }

        const periodEnd = new Date(tenant.subscription.currentPeriodEnd);

        this.logger.log(
            `Cancelando suscripción para tenant ${tenantId}`,
        );

        // Actualizar tenant - NO cambiar currentPeriodEnd
        await this.tenantModel.findByIdAndUpdate(
            tenantId,
            {
                $set: {
                    'subscription.autoRenew': false,
                    'subscription.status': SubscriptionStatus.CANCELLED,
                    'subscription.cancelledAt': new Date(),
                    'subscription.cancellationReason':
                        cancelDto.reason || 'User requested cancellation',
                },
            },
            { new: true },
        );

        // Registrar en historial
        await this.tenantModel.findByIdAndUpdate(
            tenantId,
            {
                $push: {
                    'subscription.subscriptionHistory': {
                        plan: tenant.subscription.plan,
                        startDate: tenant.subscription.currentPeriodStart,
                        endDate: periodEnd,
                        status: 'cancelled',
                        reason: cancelDto.reason || 'User requested cancellation',
                    },
                },
            },
        );

        this.logger.log(
            `Suscripción cancelada para tenant ${tenantId}. Acceso hasta: ${periodEnd.toLocaleDateString()}`,
        );

        return {
            success: true,
            message: `Suscripción cancelada. Mantendrás acceso premium hasta el ${periodEnd.toLocaleDateString()}.`,
            accessUntil: periodEnd,
            nextPlan: SubscriptionPlan.FREE,
            note: 'A partir de esa fecha, tu cuenta pasará automáticamente al plan FREE.',
        };
    }

    /**
     * Obtener historial de transacciones del tenant
     *
     * @param tenantId - ID del tenant autenticado
     * @param page - Página actual
     * @param limit - Registros por página
     * @returns Lista paginada de transacciones
     */
    async getTransactionHistory(
        tenantId: string,
        page: number = 1,
        limit: number = 10,
    ) {
        await this.findTenantOrFail(tenantId);

        const tenantObjectId = new Types.ObjectId(tenantId);
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            this.transactionModel
                .find({ tenantId: tenantObjectId } as any)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.transactionModel.countDocuments(
                { tenantId: tenantObjectId } as any,
            ),
        ]);

        return {
            data: transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }


    /**
     * Obtener estadísticas generales de suscripciones
     * Para monitoreo diario y dashboard de super admin
     *
     * @returns Conteo por estado y plan
     */
    async getSubscriptionStats() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const [
            total,
            free,
            premiumMonthly,
            premiumAnnual,
            gracePeriod,
            expiredToday,
        ] = await Promise.all([
            // Total de tenants
            this.tenantModel.countDocuments({ isActive: true }),

            // Tenants en plan FREE
            this.tenantModel.countDocuments({
                isActive: true,
                'subscription.plan': 'free',
            } as any),

            // Tenants en Premium Mensual activo
            this.tenantModel.countDocuments({
                isActive: true,
                'subscription.plan': 'premium_monthly',
                'subscription.status': 'active',
            } as any),

            // Tenants en Premium Anual activo
            this.tenantModel.countDocuments({
                isActive: true,
                'subscription.plan': 'premium_annual',
                'subscription.status': 'active',
            } as any),

            // Tenants en grace period
            this.tenantModel.countDocuments({
                isActive: true,
                'subscription.status': 'grace_period',
            } as any),

            // Tenants que expiraron hoy
            this.tenantModel.countDocuments({
                isActive: true,
                'subscription.status': 'expired',
                'subscription.currentPeriodEnd': {
                    $gte: startOfDay,
                    $lt: endOfDay,
                },
            } as any),
        ]);

        return {
            total,
            free,
            premiumMonthly,
            premiumAnnual,
            gracePeriod,
            expiredToday,
            generatedAt: now,
        };
    }

    /**
 * Obtener tenants en grace period
 * Para dashboard de super admin
 */
    async getGracePeriodTenants() {
        const tenants = await this.tenantModel
            .find({
                'subscription.status': SubscriptionStatus.GRACE_PERIOD,
            } as any)
            .select(
                'name email slug subscription.plan subscription.retryAttempts subscription.currentPeriodEnd subscription.lastRetryDate',
            )
            .sort({ 'subscription.retryAttempts': -1 })
            .lean();

        return tenants.map((tenant) => ({
            tenantId: tenant._id,
            name: tenant.name,
            email: tenant.email,
            slug: tenant.slug,
            plan: tenant.subscription?.plan,
            retryAttempts: tenant.subscription?.retryAttempts || 0,
            maxRetryAttempts: SUBSCRIPTION_RETRY_CONFIG.MAX_ATTEMPTS,
            periodEnd: tenant.subscription?.currentPeriodEnd,
            lastRetryDate: tenant.subscription?.lastRetryDate,
            daysInGracePeriod: tenant.subscription?.lastRetryDate
                ? Math.ceil(
                    (Date.now() -
                        new Date(tenant.subscription.lastRetryDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                )
                : 0,
        }));
    }

    // ============================================================
    // MÉTODOS INTERNOS - Renovación automática (Cron Jobs)
    // ============================================================

    /**
     * Procesar intentos de renovación
     * Ejecutado por el Scheduler
     *
     * @description Busca tenants en grace period o con
     * suscripción vencida y autoRenew = true,
     * luego intenta cobrar respetando el timezone del tenant
     */
    async processRenewalAttempts(): Promise<void> {
        const now = new Date();
        const maxAttempts = this.configService.get<number>(
            'subscriptions.retryMaxAttempts',
            SUBSCRIPTION_RETRY_CONFIG.MAX_ATTEMPTS,
        );

        // Buscar tenants que necesitan renovación
        const tenantsToRenew = await this.tenantModel
            .find({
                'subscription.autoRenew': true,
                'subscription.status': {
                    $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD],
                },
                'subscription.currentPeriodEnd': { $lte: now },
                'subscription.retryAttempts': { $lt: maxAttempts },
                'subscription.plan': { $ne: SubscriptionPlan.FREE },
            } as any)
            .exec();

        this.logger.log(
            `Encontrados ${tenantsToRenew.length} tenants para renovar`,
        );

        for (const tenant of tenantsToRenew) {
            await this.processRenewalForTenant(tenant);
        }
    }

    /**
     * Hacer downgrade a FREE para tenants que agotaron intentos
     * Ejecutado por el Scheduler a medianoche
     */
    async downgradeExpiredSubscriptions(): Promise<void> {
        const maxAttempts = this.configService.get<number>(
            'subscriptions.retryMaxAttempts',
            SUBSCRIPTION_RETRY_CONFIG.MAX_ATTEMPTS,
        );

        // Buscar tenants en grace period que agotaron intentos
        const expiredTenants = await this.tenantModel
            .find({
                'subscription.status': SubscriptionStatus.GRACE_PERIOD,
                'subscription.retryAttempts': { $gte: maxAttempts },
            } as any)
            .exec();

        // También buscar canceladas cuyo periodo ya terminó
        const cancelledExpired = await this.tenantModel
            .find({
                'subscription.status': SubscriptionStatus.CANCELLED,
                'subscription.currentPeriodEnd': { $lte: new Date() },
                'subscription.plan': { $ne: SubscriptionPlan.FREE },
            } as any)
            .exec();

        const allToDowngrade = [...expiredTenants, ...cancelledExpired];

        this.logger.log(
            `Procesando downgrade para ${allToDowngrade.length} tenants`,
        );

        for (const tenant of allToDowngrade) {
            await this.downgradeToFree(tenant, 'max_retry_attempts_reached');
        }
    }

    /**
     * Cobro manual por super admin
     *
     * @param tenantId - ID del tenant
     * @param manualChargeDto - Razón del cobro
     * @param superAdminId - ID del super admin que ejecuta el cobro
     * @returns Resultado del cobro
     */
    async manualCharge(
        tenantId: string,
        manualChargeDto: ManualChargeDto,
        superAdminId: string,
    ) {
        const tenant = await this.findTenantOrFail(tenantId);

        // Verificar que tiene método de pago
        if (!tenant.subscription?.paymentMethod) {
            throw new BadRequestException(
                'El tenant no tiene un método de pago guardado.',
            );
        }

        // Verificar que tiene suscripción (no FREE)
        if (tenant.subscription.plan === SubscriptionPlan.FREE) {
            throw new BadRequestException(
                'El tenant está en plan FREE. No hay suscripción que renovar.',
            );
        }

        const { customerId, paymentMethodId } =
            tenant.subscription.paymentMethod;

        this.logger.log(
            `Cobro manual iniciado por super admin ${superAdminId} para tenant ${tenantId}`,
        );

        // Intentar cobro
        const chargeResult = await this.stripeProvider.charge({
            customerId,
            paymentMethodId,
            amount: tenant.subscription.amount,
            currency: tenant.subscription.currency,
            description: `ManageCharge - Cobro manual - ${manualChargeDto.reason}`,
            metadata: {
                tenantId,
                type: 'manual',
                superAdminId,
                reason: manualChargeDto.reason,
            },
        });

        if (chargeResult.success) {
            // Renovar suscripción
            await this.renewSubscription(tenant, chargeResult.transactionId!);

            // Registrar transacción
            await this.createTransaction({
                tenantId,
                type: TransactionType.MANUAL,
                plan: tenant.subscription.plan,
                amount: tenant.subscription.amount,
                currency: tenant.subscription.currency,
                status: TransactionStatus.SUCCESS,
                provider: 'stripe',
                providerTransactionId: chargeResult.transactionId,
                providerCustomerId: customerId,
                metadata: {
                    initiatedBy: 'super_admin',
                    superAdminId,
                    reason: manualChargeDto.reason,
                },
            });

            this.logger.log(
                `Cobro manual exitoso para tenant ${tenantId}`,
            );

            return {
                success: true,
                message: 'Cobro manual procesado exitosamente',
                transactionId: chargeResult.transactionId,
                amount: tenant.subscription.amount,
                currency: tenant.subscription.currency,
            };
        } else {
            // Registrar fallo
            await this.createTransaction({
                tenantId,
                type: TransactionType.MANUAL,
                plan: tenant.subscription.plan,
                amount: tenant.subscription.amount,
                currency: tenant.subscription.currency,
                status: TransactionStatus.FAILED,
                provider: 'stripe',
                errorCode: chargeResult.errorCode,
                errorMessage: chargeResult.errorMessage,
                metadata: {
                    initiatedBy: 'super_admin',
                    superAdminId,
                    reason: manualChargeDto.reason,
                },
            });

            throw new BadRequestException(
                `El cobro fue rechazado: ${chargeResult.errorMessage}`,
            );
        }
    }

    // ============================================================
    // MÉTODOS PRIVADOS - Lógica interna
    // ============================================================

    /**
     * Procesar renovación para un tenant específico
     */
    private async processRenewalForTenant(
        tenant: TenantDocument,
    ): Promise<void> {
        const tenantId = tenant._id.toString();

        // Verificar timezone del tenant (8am-8pm)
        const timezone =
            tenant.settings?.timezone || 'America/Guatemala';

        if (!this.isWithinChargingHours(timezone)) {
            this.logger.debug(
                `Tenant ${tenantId}: fuera del horario de cobro en ${timezone}`,
            );
            return;
        }

        // Verificar que tiene método de pago
        if (!tenant.subscription?.paymentMethod) {
            this.logger.warn(
                `Tenant ${tenantId}: no tiene método de pago para renovar`,
            );
            return;
        }

        const { customerId, paymentMethodId } =
            tenant.subscription.paymentMethod;

        const retryAttempt = (tenant.subscription.retryAttempts || 0) + 1;

        this.logger.log(
            `Intentando renovación #${retryAttempt} para tenant ${tenantId}`,
        );

        // Intentar cobro
        const chargeResult = await this.stripeProvider.charge({
            customerId,
            paymentMethodId,
            amount: tenant.subscription.amount,
            currency: tenant.subscription.currency,
            description: `ManageCharge - Renovación automática`,
            metadata: {
                tenantId,
                type: 'renewal',
                attempt: retryAttempt.toString(),
            },
        });

        if (chargeResult.success) {
            // ✅ Cobro exitoso - Renovar suscripción
            await this.renewSubscription(tenant, chargeResult.transactionId!);

            // Registrar transacción
            await this.createTransaction({
                tenantId,
                type: TransactionType.RENEWAL,
                plan: tenant.subscription.plan,
                amount: tenant.subscription.amount,
                currency: tenant.subscription.currency,
                status: TransactionStatus.SUCCESS,
                provider: 'stripe',
                providerTransactionId: chargeResult.transactionId,
                providerCustomerId: customerId,
                isRetry: retryAttempt > 1,
                retryAttempt,
                metadata: { initiatedBy: 'system' },
            });

            this.logger.log(
                `✅ Renovación exitosa para tenant ${tenantId}`,
            );
        } else {
            // ❌ Cobro fallido - Incrementar intentos
            const maxAttempts = this.configService.get<number>(
                'subscriptions.retryMaxAttempts',
                SUBSCRIPTION_RETRY_CONFIG.MAX_ATTEMPTS,
            );

            await this.tenantModel.findByIdAndUpdate(
                tenant._id,
                {
                    $set: {
                        'subscription.status': SubscriptionStatus.GRACE_PERIOD,
                        'subscription.retryAttempts': retryAttempt,
                        'subscription.lastRetryDate': new Date(),
                    },
                },
            );

            // Registrar transacción fallida
            await this.createTransaction({
                tenantId,
                type: TransactionType.RENEWAL,
                plan: tenant.subscription.plan,
                amount: tenant.subscription.amount,
                currency: tenant.subscription.currency,
                status: TransactionStatus.FAILED,
                provider: 'stripe',
                errorCode: chargeResult.errorCode,
                errorMessage: chargeResult.errorMessage,
                isRetry: retryAttempt > 1,
                retryAttempt,
                metadata: { initiatedBy: 'system' },
            });

            this.logger.warn(
                `❌ Renovación fallida (intento ${retryAttempt}/${maxAttempts}) para tenant ${tenantId}: ${chargeResult.errorMessage}`,
            );
        }
    }

    /**
     * Renovar suscripción después de cobro exitoso
     * 
     * @important El nuevo periodo SIEMPRE empieza desde la fecha
     * de vencimiento original, NO desde la fecha de cobro exitoso.
     * Esto previene que usuarios ganen días gratis al retrasar el pago.
    */
    private async renewSubscription(
    tenant: TenantDocument,
    transactionId: string,
    ): Promise<void> {
    // CORRECTO - Usar fecha de vencimiento original
    const originalPeriodEnd = new Date(tenant.subscription.currentPeriodEnd);
    
    // Calcular nuevo periodo desde el vencimiento original
    const newPeriodStart = originalPeriodEnd;
    const newPeriodEnd = this.calculatePeriodEnd(
        tenant.subscription.plan as SubscriptionPlan,
        newPeriodStart,  // ← Desde el vencimiento, NO desde hoy
    );

    this.logger.log(
        `Renovando tenant ${tenant._id}: ` +
        `Periodo original: ${tenant.subscription.currentPeriodStart.toISOString()} - ${originalPeriodEnd.toISOString()} | ` +
        `Nuevo periodo: ${newPeriodStart.toISOString()} - ${newPeriodEnd.toISOString()}`
    );

    await this.tenantModel.findByIdAndUpdate(
        tenant._id,
        {
        $set: {
            'subscription.status': SubscriptionStatus.ACTIVE,
            'subscription.currentPeriodStart': newPeriodStart,      // ← Vencimiento original
            'subscription.currentPeriodEnd': newPeriodEnd,         // ← +1 mes desde vencimiento
            'subscription.retryAttempts': 0,
            'subscription.lastRetryDate': null,
            'subscription.nextRetryDate': null,
        },
        $push: {
            'subscription.subscriptionHistory': {
            plan: tenant.subscription.plan,
            startDate: tenant.subscription.currentPeriodStart,
            endDate: originalPeriodEnd,  // ← Fecha real de fin del periodo anterior
            status: 'completed',
            reason: `Renewed - Transaction: ${transactionId}`,
            },
        },
        },
    );
    }

    /**
     * Hacer downgrade a FREE
     */
    private async downgradeToFree(
        tenant: TenantDocument,
        reason: string,
    ): Promise<void> {
        const tenantId = tenant._id.toString();
        const now = new Date();

        await this.tenantModel.findByIdAndUpdate(
            tenant._id,
            {
                $set: {
                    'subscription.plan': SubscriptionPlan.FREE,
                    'subscription.status': SubscriptionStatus.EXPIRED,
                    'subscription.autoRenew': false,
                    'subscription.retryAttempts': 0,
                    'subscription.amount': 0,
                },
                $push: {
                    'subscription.subscriptionHistory': {
                        plan: tenant.subscription.plan,
                        startDate: tenant.subscription.currentPeriodStart,
                        endDate: now,
                        status: 'failed',
                        reason,
                    },
                },
            },
        );

        // Registrar transacción de downgrade
        await this.createTransaction({
            tenantId,
            type: TransactionType.DOWNGRADE,
            plan: SubscriptionPlan.FREE,
            amount: 0,
            currency: tenant.subscription.currency,
            status: TransactionStatus.SUCCESS,
            provider: 'stripe',
            metadata: {
                initiatedBy: 'system',
                reason,
            },
        });

        this.logger.warn(
            `⬇️ Tenant ${tenantId} degradado a FREE - Razón: ${reason}`,
        );
    }

    /**
     * Crear registro de transacción
     */
    private async createTransaction(data: {
        tenantId: string;
        type: TransactionType;
        plan: string;
        amount: number;
        currency: string;
        status: TransactionStatus;
        provider: string;
        providerTransactionId?: string;
        providerCustomerId?: string;
        errorCode?: string;
        errorMessage?: string;
        isRetry?: boolean;
        retryAttempt?: number;
        metadata?: any;
    }): Promise<void> {
        const transaction = new this.transactionModel({
            tenantId: new Types.ObjectId(data.tenantId),
            type: data.type,
            plan: data.plan,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            provider: data.provider,
            providerTransactionId: data.providerTransactionId,
            providerCustomerId: data.providerCustomerId,
            errorCode: data.errorCode,
            errorMessage: data.errorMessage,
            isRetry: data.isRetry || false,
            retryAttempt: data.retryAttempt,
            metadata: data.metadata,
        });

        await transaction.save();
    }

    /**
     * Verificar si estamos dentro del horario de cobro (8am-8pm)
     * respetando el timezone del tenant
     */
    private isWithinChargingHours(timezone: string): boolean {
        try {
            const now = new Date();

            // Obtener hora actual en el timezone del tenant
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                hour12: false,
            });

            const hour = parseInt(formatter.format(now), 10);

            // Permitir cobros entre 8am y 8pm
            return hour >= 8 && hour < 20;
        } catch (error) {
            // Si el timezone es inválido, usar UTC
            this.logger.warn(
                `Timezone inválido: ${timezone}. Usando UTC.`,
            );
            const hour = new Date().getUTCHours();
            return hour >= 8 && hour < 20;
        }
    }

    /**
     * Calcular fecha de fin del periodo según el plan
     */
    private calculatePeriodEnd(
        plan: SubscriptionPlan,
        startDate: Date,
    ): Date {
        const end = new Date(startDate);

        if (plan === SubscriptionPlan.PREMIUM_ANNUAL) {
            end.setFullYear(end.getFullYear() + 1); // +1 año
        } else {
            end.setMonth(end.getMonth() + 1); // +1 mes
        }

        return end;
    }

    /**
     * Construir mensajes informativos según estado
     */
    private buildStatusMessages(
        subscription: any,
        daysRemaining: number,
        isCancelledButActive: boolean,
        periodEnd: Date,
    ): string[] {
        const messages: string[] = [];

        if (subscription.plan === SubscriptionPlan.FREE) {
            messages.push(
                'Estás en el plan FREE. Actualiza a Premium para acceder a todas las funciones.',
            );
            return messages;
        }

        if (isCancelledButActive) {
            messages.push(
                `Tu suscripción fue cancelada. Tienes acceso premium por ${daysRemaining} días más (hasta ${periodEnd.toLocaleDateString()}).`,
            );
            messages.push(
                'Después de esa fecha, tu cuenta pasará automáticamente al plan FREE.',
            );
            return messages;
        }

        if (subscription.status === SubscriptionStatus.GRACE_PERIOD) {
            messages.push(
                `No pudimos renovar tu suscripción. Intento ${subscription.retryAttempts}/7.`,
            );
            messages.push(
                'Por favor actualiza tu método de pago para evitar perder el acceso premium.',
            );
            return messages;
        }

        if (subscription.status === SubscriptionStatus.ACTIVE) {
            if (daysRemaining <= 7) {
                messages.push(
                    `Tu suscripción vence en ${daysRemaining} días (${periodEnd.toLocaleDateString()}).`,
                );
            } else {
                messages.push(
                    `Suscripción activa. Próximo cobro: ${periodEnd.toLocaleDateString()}.`,
                );
            }
        }

        return messages;
    }

    /**
     * Obtener label del intervalo según moneda
     */
    private getIntervalLabel(
        interval: 'month' | 'year',
        currency: string,
    ): string {
        const labels: Record<string, Record<string, string>> = {
            month: {
                USD: 'month',
                GTQ: 'mes',
                MXN: 'mes',
                COP: 'mes',
                DEFAULT: 'mes',
            },
            year: {
                USD: 'year',
                GTQ: 'año',
                MXN: 'año',
                COP: 'año',
                DEFAULT: 'año',
            },
        };

        return labels[interval][currency] || labels[interval]['DEFAULT'];
    }

    /**
     * Buscar tenant o lanzar excepción
     */
    private async findTenantOrFail(
        tenantId: string,
    ): Promise<TenantDocument> {
        const tenant = await this.tenantModel.findById(tenantId).exec();

        if (!tenant) {
            throw new NotFoundException(
                `Tenant con ID ${tenantId} no encontrado`,
            );
        }

        return tenant;
    }
}