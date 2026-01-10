import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './entities/index.js';
import { CreateTenantDto, UpdateTenantDto } from './dto/index.js';

/**
 * TenantsService
 * 
 * @description Servicio que contiene toda la lógica de negocio
 * relacionada con los Tenants (empresas/freelancers).
 * 
 * Responsabilidades:
 * - CRUD de tenants
 * - Validaciones de negocio (slug único, etc.)
 * - Interacción con MongoDB
 */
@Injectable()
export class TenantsService {
    /**
     * Constructor con inyección de dependencias
     * 
     * @param tenantModel - Modelo de Mongoose inyectado por NestJS
     * 
     * @description El decorador @InjectModel() le dice a NestJS
     * que inyecte el modelo de Mongoose para la entidad Tenant.
     * Esto nos permite usar métodos como find(), create(), etc.
     */
    constructor(
        @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    ) { }

    /**
     * Crear un nuevo Tenant
     * 
     * @param createTenantDto - Datos validados del nuevo tenant
     * @returns El tenant creado
     * @throws ConflictException si el slug o email ya existen
     */
    async create(createTenantDto: CreateTenantDto): Promise<TenantDocument> {
        // Verificar si el slug ya existe
        const existingSlug = await this.tenantModel.findOne({
            slug: createTenantDto.slug,
        });

        if (existingSlug) {
            throw new ConflictException(
                `El slug "${createTenantDto.slug}" ya está en uso`,
            );
        }

        // Verificar si el email ya existe
        const existingEmail = await this.tenantModel.findOne({
            email: createTenantDto.email.toLowerCase(),
        });

        if (existingEmail) {
            throw new ConflictException(
                `El email "${createTenantDto.email}" ya está registrado`,
            );
        }

        // Crear el nuevo tenant
        const newTenant = new this.tenantModel({
            ...createTenantDto,
            email: createTenantDto.email.toLowerCase(), // Normalizar email
        });

        // Guardar en la base de datos y retornar
        return newTenant.save();
    }

    /**
     * Obtener todos los Tenants
     * 
     * @param onlyActive - Si es true, solo retorna tenants activos
     * @returns Lista de tenants
     * 
     * @description Por defecto retorna todos los tenants.
     * En producción, este endpoint debería estar protegido
     * y solo ser accesible por SUPER_ADMIN.
     */
    async findAll(onlyActive: boolean = true): Promise<TenantDocument[]> {
        const filter = onlyActive ? { isActive: true } : {};

        return this.tenantModel
            .find(filter)
            .sort({ createdAt: -1 }) // Más recientes primero
            .exec();
    }

    /**
     * Obtener un Tenant por su ID
     * 
     * @param id - ID del tenant (ObjectId de MongoDB)
     * @returns El tenant encontrado
     * @throws NotFoundException si no existe
     */
    async findById(id: string): Promise<TenantDocument> {
        const tenant = await this.tenantModel.findById(id).exec();

        if (!tenant) {
            throw new NotFoundException(`Tenant con ID "${id}" no encontrado`);
        }

        return tenant;
    }

    /**
     * Obtener un Tenant por su slug
     * 
     * @param slug - Slug único del tenant
     * @returns El tenant encontrado
     * @throws NotFoundException si no existe
     * 
     * @description Útil para URLs amigables como
     * managecharge.com/tenant/agencia-digital-gt
     */
    async findBySlug(slug: string): Promise<TenantDocument> {
        const tenant = await this.tenantModel
            .findOne({ slug: slug.toLowerCase() })
            .exec();

        if (!tenant) {
            throw new NotFoundException(`Tenant con slug "${slug}" no encontrado`);
        }

        return tenant;
    }

    /**
     * Obtener un Tenant por su email
     * 
     * @param email - Email del tenant
     * @returns El tenant encontrado o null
     * 
     * @description No lanza excepción si no existe,
     * retorna null. Útil para verificaciones.
     */
    async findByEmail(email: string): Promise<TenantDocument | null> {
        return this.tenantModel
            .findOne({ email: email.toLowerCase() })
            .exec();
    }

    /**
     * Actualizar un Tenant
     * 
     * @param id - ID del tenant a actualizar
     * @param updateTenantDto - Datos a actualizar (parciales)
     * @returns El tenant actualizado
     * @throws NotFoundException si no existe
     * @throws ConflictException si el nuevo slug/email ya existe
     */
    async update(
        id: string,
        updateTenantDto: UpdateTenantDto,
    ): Promise<TenantDocument> {
        // Primero verificamos que el tenant existe
        const existingTenant = await this.findById(id);

        // Si se quiere cambiar el slug, verificar que no esté en uso
        if (
            updateTenantDto.slug &&
            updateTenantDto.slug !== existingTenant.slug
        ) {
            const slugInUse = await this.tenantModel.findOne({
                slug: updateTenantDto.slug,
                _id: { $ne: id }, // Excluir el tenant actual
            });

            if (slugInUse) {
                throw new ConflictException(
                    `El slug "${updateTenantDto.slug}" ya está en uso`,
                );
            }
        }

        // Si se quiere cambiar el email, verificar que no esté en uso
        if (
            updateTenantDto.email &&
            updateTenantDto.email.toLowerCase() !== existingTenant.email
        ) {
            const emailInUse = await this.tenantModel.findOne({
                email: updateTenantDto.email.toLowerCase(),
                _id: { $ne: id },
            });

            if (emailInUse) {
                throw new ConflictException(
                    `El email "${updateTenantDto.email}" ya está registrado`,
                );
            }
        }

        // Normalizar email si se proporciona
        const dataToUpdate = { ...updateTenantDto };
        if (dataToUpdate.email) {
            dataToUpdate.email = dataToUpdate.email.toLowerCase();
        }

        // Actualizar y retornar el documento actualizado
        const updatedTenant = await this.tenantModel
            .findByIdAndUpdate(
                id,
                { $set: dataToUpdate },
                { new: true },
            )
            .exec();

        // Verificación de seguridad (TypeScript lo requiere)
        if (!updatedTenant) {
            throw new NotFoundException(`Tenant con ID "${id}" no encontrado`);
        }

        return updatedTenant;
    }

    /**
     * Desactivar un Tenant (soft delete)
     * 
     * @param id - ID del tenant a desactivar
     * @returns El tenant desactivado
     * @throws NotFoundException si no existe
     * 
     * @description No eliminamos tenants físicamente, solo los desactivamos.
     * Esto preserva el historial y permite reactivarlos si es necesario.
     */
    async deactivate(id: string): Promise<TenantDocument> {
        const tenant = await this.findById(id);

        tenant.isActive = false;
        return tenant.save();
    }

    /**
     * Reactivar un Tenant
     * 
     * @param id - ID del tenant a reactivar
     * @returns El tenant reactivado
     * @throws NotFoundException si no existe
     */
    async reactivate(id: string): Promise<TenantDocument> {
        const tenant = await this.findById(id);

        tenant.isActive = true;
        return tenant.save();
    }

    /**
     * Eliminar un Tenant permanentemente
     * 
     * @param id - ID del tenant a eliminar
     * @throws NotFoundException si no existe
     * 
     * @description ⚠️ CUIDADO: Esta acción es irreversible.
     * Solo debe usarse en casos excepcionales.
     * Normalmente usamos deactivate() en su lugar.
     */
    async remove(id: string): Promise<void> {
        const tenant = await this.findById(id);
        await this.tenantModel.findByIdAndDelete(tenant._id).exec();
    }

    /**
     * Contar tenants activos
     * 
     * @returns Número total de tenants activos
     * 
     * @description Útil para dashboards y métricas del Super Admin
     */
    async countActive(): Promise<number> {
        return this.tenantModel.countDocuments({ isActive: true }).exec();
    }

    /**
     * Verificar si un slug está disponible
     * 
     * @param slug - Slug a verificar
     * @param excludeId - ID a excluir (para updates)
     * @returns true si está disponible, false si ya existe
     */
    async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = { slug: slug.toLowerCase() };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existing = await this.tenantModel.findOne(query).exec();
        return !existing;
    }
}