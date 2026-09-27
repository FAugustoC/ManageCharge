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
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { UsersService } from './users.service.js';
import { CreateUserDto, UpdateUserDto } from './dto/index.js';
import type { UserDocument } from './entities/index.js';
import {
  Roles,
  CurrentUser,
  RolesGuard,
  UserRole,
  AuthProvider,
} from '../../common/index.js';
import type { AuthenticatedUser } from '../../common/index.js';

/**
 * UsersController
 *
 * @description Controlador REST para gestionar Users.
 *
 * Base URL: /api/v1/users
 *
 * Reglas de permisos:
 * - SUPER_ADMIN: gestiona usuarios de cualquier tenant.
 * - TENANT_ADMIN: gestiona SOLO usuarios de su propio tenant.
 * - TENANT_USER: solo puede ver y editar su propio perfil
 *   (sin cambiar su rol ni su tenant).
 *
 * Nadie puede crear o asignar el rol SUPER_ADMIN desde este controlador.
 * Los super admins se crean únicamente con POST /super-admin/users
 * o con el script de seed (npm run seed:super-admin).
 *
 * Nota: JwtAuthGuard es global (APP_GUARD en app.module.ts), por eso
 * aquí solo agregamos RolesGuard.
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * POST /users
   * Crear un nuevo User dentro de un tenant
   */
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description:
      'SUPER_ADMIN puede crear usuarios en cualquier tenant (debe indicar tenantId). ' +
      'TENANT_ADMIN solo puede crearlos en su propio tenant. ' +
      'No permite crear SUPER_ADMIN (usar POST /super-admin/users).',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 403, description: 'Sin permisos para esta operación' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    // 1. Este endpoint nunca crea super admins
    if (createUserDto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No se puede crear un SUPER_ADMIN desde este endpoint',
      );
    }

    // 2. Determinar el tenant del nuevo usuario
    let tenantId: string;

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (!createUserDto.tenantId) {
        throw new BadRequestException(
          'El tenantId es requerido para crear usuarios de un tenant',
        );
      }
      if (!(await this.usersService.tenantExists(createUserDto.tenantId))) {
        throw new BadRequestException(
          `El tenant "${createUserDto.tenantId}" no existe`,
        );
      }
      tenantId = createUserDto.tenantId;
    } else {
      // TENANT_ADMIN: se ignora cualquier tenantId enviado y se usa
      // SIEMPRE el suyo. Así es imposible crear usuarios en otro tenant.
      tenantId = this.requireTenantId(currentUser);
    }

    // 3. Solo registro con email/contraseña. Los usuarios de Google/Apple
    //    se crean solos al iniciar sesión con OAuth, nunca a mano, porque
    //    permitirlo dejaría "pre-registrar" la cuenta de Google de otra persona.
    if (!createUserDto.password) {
      throw new BadRequestException('La contraseña es requerida');
    }

    const user = await this.usersService.create({
      ...createUserDto,
      tenantId,
      role: createUserDto.role ?? UserRole.TENANT_USER,
      authProvider: AuthProvider.LOCAL,
      providerId: undefined,
    });

    return {
      success: true,
      message: 'Usuario creado exitosamente',
      data: user,
    };
  }

  /**
   * GET /users
   * SUPER_ADMIN: todos los usuarios. TENANT_ADMIN: los de su tenant.
   */
  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'SUPER_ADMIN ve todos los usuarios. TENANT_ADMIN solo los de su tenant.',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false', 'all'],
    description: 'Filtrar por estado activo',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('active') active?: string,
  ) {
    const isActive = this.parseActiveFilter(active);

    const users =
      currentUser.role === UserRole.SUPER_ADMIN
        ? await this.usersService.findAll(isActive)
        : await this.usersService.findAllByTenant(
          this.requireTenantId(currentUser),
          isActive,
        );

    return {
      success: true,
      message: 'Usuarios obtenidos exitosamente',
      data: users,
      meta: {
        total: users.length,
        filter: {
          active: isActive ?? 'all',
        },
      },
    };
  }

  /**
   * GET /users/by-tenant/:tenantId
   * Obtener todos los Users de un Tenant específico
   */
  @Get('by-tenant/:tenantId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Listar usuarios de un tenant',
    description: 'TENANT_ADMIN solo puede consultar su propio tenant.',
  })
  @ApiParam({ name: 'tenantId', description: 'ID del tenant' })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false', 'all'],
  })
  @ApiResponse({ status: 200, description: 'Lista de usuarios del tenant' })
  @ApiResponse({ status: 403, description: 'Sin permisos para este tenant' })
  async findByTenant(
    @Param('tenantId') tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('active') active?: string,
  ) {
    this.assertTenantAccess(currentUser, tenantId);

    const isActive = this.parseActiveFilter(active);
    const users = await this.usersService.findAllByTenant(tenantId, isActive);

    return {
      success: true,
      message: 'Usuarios del tenant obtenidos exitosamente',
      data: users,
      meta: {
        total: users.length,
        tenantId,
        filter: {
          active: isActive ?? 'all',
        },
      },
    };
  }

  /**
   * GET /users/by-email/:email
   * Obtener un User por su email
   */
  @Get('by-email/:email')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Buscar usuario por email',
    description: 'TENANT_ADMIN solo encuentra usuarios de su propio tenant.',
  })
  @ApiParam({ name: 'email', description: 'Email del usuario' })
  @ApiResponse({ status: 200, description: 'Resultado de la búsqueda' })
  async findByEmail(
    @Param('email') email: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const user = await this.usersService.findByEmail(email);

    // Si el usuario pertenece a otro tenant respondemos igual que si no
    // existiera. Así nadie puede usar este endpoint para averiguar qué
    // emails están registrados en otros tenants.
    if (!user || !this.canManageUser(currentUser, user)) {
      return {
        success: false,
        message: 'Usuario no encontrado',
        data: null,
      };
    }

    return {
      success: true,
      data: user,
    };
  }

  /**
   * GET /users/count/:tenantId
   * Contar usuarios de un tenant
   */
  @Get('count/:tenantId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Contar usuarios de un tenant' })
  @ApiParam({ name: 'tenantId', description: 'ID del tenant' })
  @ApiResponse({ status: 200, description: 'Total de usuarios' })
  @ApiResponse({ status: 403, description: 'Sin permisos para este tenant' })
  async countByTenant(
    @Param('tenantId') tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.assertTenantAccess(currentUser, tenantId);

    const total = await this.usersService.countByTenant(tenantId);

    return {
      success: true,
      data: {
        tenantId,
        total,
      },
    };
  }

  /**
   * GET /users/:id
   * Obtener un User por su ID
   */
  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.TENANT_USER)
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description:
      'TENANT_ADMIN: usuarios de su tenant. TENANT_USER: solo su propio perfil.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const user = await this.findAccessibleUser(currentUser, id);

    return {
      success: true,
      data: user,
    };
  }

  /**
   * PUT /users/:id
   * Actualizar un User completamente
   */
  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Actualizar usuario (completo)' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  @ApiResponse({ status: 403, description: 'Cambio no permitido' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const user = await this.applyUpdate(currentUser, id, updateUserDto);

    return {
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user,
    };
  }

  /**
   * PATCH /users/:id
   * Actualizar un User parcialmente
   */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Actualizar usuario (parcial)' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  @ApiResponse({ status: 403, description: 'Cambio no permitido' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const user = await this.applyUpdate(currentUser, id, updateUserDto);

    return {
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user,
    };
  }

  /**
   * PATCH /users/:id/deactivate
   * Desactivar un User
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Desactivar usuario' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario desactivado' })
  @ApiResponse({ status: 403, description: 'Operación no permitida' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.findManageableUser(currentUser, id, 'desactivar');
    const user = await this.usersService.deactivate(id);

    return {
      success: true,
      message: 'Usuario desactivado exitosamente',
      data: user,
    };
  }

  /**
   * PATCH /users/:id/reactivate
   * Reactivar un User
   */
  @Patch(':id/reactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Reactivar usuario' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario reactivado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async reactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.findManageableUser(currentUser, id, 'reactivar');
    const user = await this.usersService.reactivate(id);

    return {
      success: true,
      message: 'Usuario reactivado exitosamente',
      data: user,
    };
  }

  /**
   * DELETE /users/:id
   * Eliminar un User permanentemente
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar usuario permanentemente' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado' })
  @ApiResponse({ status: 403, description: 'Operación no permitida' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.findManageableUser(currentUser, id, 'eliminar');
    await this.usersService.remove(id);

    return {
      success: true,
      message: 'Usuario eliminado exitosamente',
    };
  }

  // ============================================================
  // MÉTODOS PRIVADOS - Reglas de autorización
  // ============================================================

  /**
   * ¿Puede el usuario actual administrar al usuario objetivo?
   *
   * @description SUPER_ADMIN: siempre. TENANT_ADMIN: solo si ambos
   * pertenecen al mismo tenant. TENANT_USER: nunca administra a otros.
   */
  private canManageUser(
    currentUser: AuthenticatedUser,
    target: UserDocument,
  ): boolean {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (currentUser.role === UserRole.TENANT_ADMIN) {
      const targetTenantId = target.tenantId?.toString();
      return !!targetTenantId && targetTenantId === currentUser.tenantId;
    }

    return false;
  }

  /**
   * Buscar un usuario que el actual pueda VER
   *
   * @description Si el usuario pertenece a otro tenant se responde 404
   * (y no 403) para no confirmar que ese ID existe.
   */
  private async findAccessibleUser(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<UserDocument> {
    const target = await this.usersService.findById(id);

    const isSelf = target._id.toString() === currentUser.userId;

    if (!isSelf && !this.canManageUser(currentUser, target)) {
      throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
    }

    return target;
  }

  /**
   * Buscar un usuario que el actual pueda ADMINISTRAR
   * (desactivar, reactivar, eliminar)
   */
  private async findManageableUser(
    currentUser: AuthenticatedUser,
    id: string,
    action: string,
  ): Promise<UserDocument> {
    const target = await this.usersService.findById(id);

    if (!this.canManageUser(currentUser, target)) {
      throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
    }

    // Evita que alguien se bloquee a sí mismo por accidente
    // y deje al tenant sin administrador.
    if (target._id.toString() === currentUser.userId) {
      throw new ForbiddenException(`No puedes ${action} tu propia cuenta`);
    }

    // Los super admins se gestionan desde el módulo super-admin
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        `No se puede ${action} un SUPER_ADMIN desde este endpoint`,
      );
    }

    return target;
  }

  /**
   * Validar permisos y aplicar una actualización
   *
   * @description Construye una copia "limpia" del DTO con solo los
   * campos que el usuario actual tiene permitido cambiar.
   */
  private async applyUpdate(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserDocument> {
    const target = await this.findAccessibleUser(currentUser, id);
    const changes: UpdateUserDto = { ...dto };

    // Regla 1: el rol SUPER_ADMIN no se asigna ni se quita por aquí
    if (
      changes.role !== undefined &&
      (changes.role === UserRole.SUPER_ADMIN ||
        target.role === UserRole.SUPER_ADMIN) &&
      changes.role !== target.role
    ) {
      throw new ForbiddenException(
        'El rol SUPER_ADMIN no se puede asignar ni quitar desde este endpoint',
      );
    }

    // Regla 2: TENANT_USER solo edita sus datos personales
    if (currentUser.role === UserRole.TENANT_USER) {
      if (changes.role !== undefined && changes.role !== target.role) {
        throw new ForbiddenException('No puedes cambiar tu propio rol');
      }
      if (
        changes.tenantId !== undefined &&
        changes.tenantId !== target.tenantId?.toString()
      ) {
        throw new ForbiddenException('No puedes cambiar tu tenant');
      }
      delete changes.role;
      delete changes.tenantId;
    }

    // Regla 3: TENANT_ADMIN no mueve usuarios a otro tenant
    // y no puede quitarse a sí mismo el rol de administrador
    if (currentUser.role === UserRole.TENANT_ADMIN) {
      if (
        changes.tenantId !== undefined &&
        changes.tenantId !== currentUser.tenantId
      ) {
        throw new ForbiddenException(
          'No puedes mover usuarios a otro tenant',
        );
      }
      delete changes.tenantId;

      const isSelf = target._id.toString() === currentUser.userId;
      if (
        isSelf &&
        changes.role !== undefined &&
        changes.role !== UserRole.TENANT_ADMIN
      ) {
        throw new ForbiddenException(
          'No puedes quitarte el rol de administrador a ti mismo',
        );
      }
    }

    // Regla 4: SUPER_ADMIN puede mover usuarios, pero a un tenant que exista
    if (
      currentUser.role === UserRole.SUPER_ADMIN &&
      changes.tenantId !== undefined &&
      !(await this.usersService.tenantExists(changes.tenantId))
    ) {
      throw new BadRequestException(
        `El tenant "${changes.tenantId}" no existe`,
      );
    }

    return this.usersService.update(id, changes);
  }

  /**
   * Validar acceso a un tenant indicado en la URL
   */
  private assertTenantAccess(
    currentUser: AuthenticatedUser,
    tenantId: string,
  ): void {
    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      tenantId !== currentUser.tenantId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para consultar usuarios de este tenant',
      );
    }
  }

  /**
   * Obtener el tenantId del usuario actual o fallar
   */
  private requireTenantId(currentUser: AuthenticatedUser): string {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Tu usuario no tiene un tenant asignado');
    }
    return currentUser.tenantId;
  }

  /**
   * Convertir el query param "active" a boolean | undefined
   */
  private parseActiveFilter(active?: string): boolean | undefined {
    if (active === 'true') return true;
    if (active === 'false') return false;
    return undefined; // 'all' o sin valor: mostrar todos
  }
}
