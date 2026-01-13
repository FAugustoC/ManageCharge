import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './entities/index.js';
import { CreateUserDto, UpdateUserDto } from './dto/index.js';
import { UserRole, AuthProvider, PASSWORD_CONFIG } from '../../common/index.js';

/**
 * UsersService
 * 
 * @description Servicio que contiene toda la lógica de negocio
 * relacionada con los Users (usuarios del sistema).
 * 
 * Responsabilidades:
 * - CRUD de usuarios
 * - Hasheo de contraseñas
 * - Validaciones de negocio
 * - Búsquedas por tenant, email, proveedor OAuth
 */
@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    /**
     * Hashear una contraseña
     * 
     * @param password - Contraseña en texto plano
     * @returns Contraseña hasheada
     * 
     * @description Usa bcrypt con salt rounds configurados
     * para generar un hash seguro e irreversible.
     */
    private async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);
    }

    /**
     * Comparar contraseña con hash
     * 
     * @param password - Contraseña en texto plano
     * @param hash - Hash almacenado en la base de datos
     * @returns true si coinciden, false si no
     */
    async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Crear un nuevo User
     * 
     * @param createUserDto - Datos validados del nuevo usuario
     * @returns El usuario creado (sin contraseña)
     * @throws ConflictException si el email ya existe
     * @throws BadRequestException si falta contraseña para auth LOCAL
     */
    async create(createUserDto: CreateUserDto): Promise<UserDocument> {
        // Verificar si el email ya existe
        const existingUser = await this.userModel.findOne({
            email: createUserDto.email.toLowerCase(),
        });

        if (existingUser) {
            throw new ConflictException(
                `El email "${createUserDto.email}" ya está registrado`,
            );
        }

        // Determinar el proveedor de autenticación
        const authProvider = createUserDto.authProvider || AuthProvider.LOCAL;

        // Para autenticación LOCAL, la contraseña es obligatoria
        if (authProvider === AuthProvider.LOCAL && !createUserDto.password) {
            throw new BadRequestException(
                'La contraseña es requerida para registro con email',
            );
        }

        // Preparar datos del usuario
        const userData: Record<string, unknown> = {
            email: createUserDto.email.toLowerCase(),
            firstName: createUserDto.firstName,
            lastName: createUserDto.lastName,
            phone: createUserDto.phone,
            role: createUserDto.role || UserRole.TENANT_USER,
            authProvider,
            providerId: createUserDto.providerId,
            avatar: createUserDto.avatar,
            isActive: true,
            // Para OAuth, el email ya está verificado
            emailVerified: authProvider !== AuthProvider.LOCAL,
        };

        // Convertir tenantId string a ObjectId si existe
        if (createUserDto.tenantId) {
            userData.tenantId = new Types.ObjectId(createUserDto.tenantId);
        }

        // Hashear contraseña si existe
        if (createUserDto.password) {
            userData.password = await this.hashPassword(createUserDto.password);
        }

        // Crear y guardar el usuario
        const newUser = new this.userModel(userData);
        const savedUser = await newUser.save();

        // Retornar sin la contraseña (seguridad)
        return this.sanitizeUser(savedUser);
    }

    /**
     * Obtener todos los Users de un Tenant
     * 
     * @param tenantId - ID del tenant
     * @param isActive - true: solo activos, false: solo inactivos, undefined: todos
     * @returns Lista de usuarios del tenant
     */
    async findAllByTenant(
        tenantId: string,
        isActive?: boolean,
    ): Promise<UserDocument[]> {
        const filter: Record<string, unknown> = {
            tenantId: new Types.ObjectId(tenantId),
        };

        if (isActive !== undefined) {
            filter.isActive = isActive;
        }

        const users = await this.userModel
            .find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .exec();

        return users;
    }

    /**
     * Obtener todos los Users (solo para SUPER_ADMIN)
     * 
     * @param isActive - true: solo activos, false: solo inactivos, undefined: todos
     * @returns Lista de usuarios
     */
    async findAll(isActive?: boolean): Promise<UserDocument[]> {
        // Construir filtro según el parámetro
        const filter: Record<string, unknown> = {};

        // Solo agregar filtro si isActive tiene un valor definido
        if (isActive !== undefined) {
            filter.isActive = isActive;
        }

        const users = await this.userModel
            .find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .exec();

        return users;
    }

    /**
     * Obtener un User por su ID
     * 
     * @param id - ID del usuario
     * @returns El usuario encontrado (sin contraseña)
     * @throws NotFoundException si no existe
     */
    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel
            .findById(id)
            .select('-password')
            .exec();

        if (!user) {
            throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
        }

        return user;
    }

    /**
     * Obtener un User por su ID (con contraseña)
     * 
     * @param id - ID del usuario
     * @returns El usuario con contraseña (para validación interna)
     * 
     * @description SOLO usar internamente para validar contraseñas.
     * Nunca exponer este método en el controller.
     */
    async findByIdWithPassword(id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(id).exec();

        if (!user) {
            throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
        }

        return user;
    }

    /**
     * Obtener un User por su email
     * 
     * @param email - Email del usuario
     * @returns El usuario encontrado o null
     */
    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel
            .findOne({ email: email.toLowerCase() })
            .select('-password')
            .exec();
    }

    /**
     * Obtener un User por email (con contraseña)
     * 
     * @param email - Email del usuario
     * @returns El usuario con contraseña (para login)
     * 
     * @description SOLO usar en AuthService para validar login.
     */
    async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
        return this.userModel
            .findOne({ email: email.toLowerCase() })
            .exec();
    }

    /**
     * Buscar usuario por proveedor OAuth
     * 
     * @param provider - Proveedor (GOOGLE, APPLE)
     * @param providerId - ID único del proveedor
     * @returns El usuario encontrado o null
     * 
     * @description Se usa para verificar si ya existe una cuenta
     * vinculada con ese proveedor OAuth.
     */
    async findByProvider(
        provider: AuthProvider,
        providerId: string,
    ): Promise<UserDocument | null> {
        return this.userModel
            .findOne({ authProvider: provider, providerId })
            .select('-password')
            .exec();
    }

    /**
     * Actualizar un User
     * 
     * @param id - ID del usuario a actualizar
     * @param updateUserDto - Datos a actualizar
     * @returns El usuario actualizado
     * @throws NotFoundException si no existe
     */
    async update(
        id: string,
        updateUserDto: UpdateUserDto,
    ): Promise<UserDocument> {
        // Verificar que el usuario existe
        await this.findById(id);

        // Preparar datos para actualizar
        const updateData: Record<string, unknown> = { ...updateUserDto };

        // Convertir tenantId si existe
        if (updateUserDto.tenantId) {
            updateData.tenantId = new Types.ObjectId(updateUserDto.tenantId);
        }

        const updatedUser = await this.userModel
            .findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true },
            )
            .select('-password')
            .exec();

        if (!updatedUser) {
            throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
        }

        return updatedUser;
    }

    /**
     * Cambiar contraseña de un User
     * 
     * @param id - ID del usuario
     * @param currentPassword - Contraseña actual
     * @param newPassword - Nueva contraseña
     * @throws BadRequestException si la contraseña actual es incorrecta
     * @throws BadRequestException si el usuario usa OAuth
     */
    async changePassword(
        id: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<void> {
        const user = await this.findByIdWithPassword(id);

        // Verificar que no sea usuario OAuth
        if (user.authProvider !== AuthProvider.LOCAL) {
            throw new BadRequestException(
                'Los usuarios con OAuth no pueden cambiar contraseña',
            );
        }

        // Verificar contraseña actual
        if (!user.password) {
            throw new BadRequestException('El usuario no tiene contraseña configurada');
        }

        const isPasswordValid = await this.comparePassword(
            currentPassword,
            user.password,
        );

        if (!isPasswordValid) {
            throw new BadRequestException('La contraseña actual es incorrecta');
        }

        // Hashear y guardar nueva contraseña
        const hashedPassword = await this.hashPassword(newPassword);

        await this.userModel
            .findByIdAndUpdate(id, { password: hashedPassword })
            .exec();
    }

    /**
     * Actualizar fecha de último login
     * 
     * @param id - ID del usuario
     */
    async updateLastLogin(id: string): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(id, { lastLoginAt: new Date() })
            .exec();
    }

    /**
     * Marcar email como verificado
     * 
     * @param id - ID del usuario
     */
    async verifyEmail(id: string): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(id, {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            })
            .exec();
    }

    /**
     * Desactivar un User (soft delete)
     * 
     * @param id - ID del usuario a desactivar
     * @returns El usuario desactivado
     */
    async deactivate(id: string): Promise<UserDocument> {
        const user = await this.findById(id);

        const deactivatedUser = await this.userModel
            .findByIdAndUpdate(
                user._id,
                { isActive: false },
                { new: true },
            )
            .select('-password')
            .exec();

        return deactivatedUser!;
    }

    /**
     * Reactivar un User
     * 
     * @param id - ID del usuario a reactivar
     * @returns El usuario reactivado
     */
    async reactivate(id: string): Promise<UserDocument> {
        const user = await this.findById(id);

        const reactivatedUser = await this.userModel
            .findByIdAndUpdate(
                user._id,
                { isActive: true },
                { new: true },
            )
            .select('-password')
            .exec();

        return reactivatedUser!;
    }

    /**
     * Eliminar un User permanentemente
     * 
     * @param id - ID del usuario a eliminar
     */
    async remove(id: string): Promise<void> {
        const user = await this.findById(id);
        await this.userModel.findByIdAndDelete(user._id).exec();
    }

    /**
     * Contar usuarios activos de un tenant
     * 
     * @param tenantId - ID del tenant (string)
     * @returns Número de usuarios activos
     */
    async countByTenant(tenantId: string): Promise<number> {
        const result = await this.userModel
            .countDocuments()
            .where('tenantId').equals(tenantId)
            .where('isActive').equals(true)
            .exec();

        return result;
    }

    /**
     * Sanitizar usuario (remover datos sensibles)
     * 
     * @param user - Documento del usuario
     * @returns Usuario sin datos sensibles
     * 
     * @description Remueve la contraseña y tokens sensibles
     * antes de retornar el usuario al cliente.
     */
    private sanitizeUser(user: UserDocument): UserDocument {
        const userObject = user.toObject();
        delete userObject.password;
        delete userObject.emailVerificationToken;
        delete userObject.passwordResetToken;
        return userObject as UserDocument;
    }
}