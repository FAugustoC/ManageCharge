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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { TenantsService } from './tenants.service.js';
import { CreateTenantDto, UpdateTenantDto } from './dto/index.js';
import { 
  Roles, 
  CurrentUser, 
  RolesGuard, 
  UserRole,
} from '../../common/index.js';

/**
 * Interfaz para el usuario autenticado
 * Definida localmente para evitar problemas con isolatedModules
 */
interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId?: string;
}

/**
 * TenantsController
 * 
 * @description Controlador REST para gestionar Tenants.
 * 
 * Permisos:
 * - SUPER_ADMIN: Acceso completo a todos los tenants
 * - TENANT_ADMIN: Solo puede ver/editar su propio tenant
 * - TENANT_USER: Solo puede ver su propio tenant
 * 
 * Base URL: /api/v1/tenants
 */
@ApiTags('Tenants')
@ApiBearerAuth('JWT-auth')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * POST /tenants
   * Crear un nuevo Tenant (Solo SUPER_ADMIN)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Crear un nuevo tenant (Solo SUPER_ADMIN)',
    description: 'Registra una nueva empresa o freelancer en ManageCharge',
  })
  @ApiResponse({ status: 201, description: 'Tenant creado exitosamente' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para crear tenants' })
  @ApiResponse({ status: 409, description: 'El slug o email ya están en uso' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    const tenant = await this.tenantsService.create(createTenantDto);

    return {
      success: true,
      message: 'Tenant creado exitosamente',
      data: tenant,
    };
  }

  /**
   * GET /tenants
   * Obtener todos los Tenants (SUPER_ADMIN) o el propio tenant (otros roles)
   */
  @Get()
  @ApiOperation({ 
    summary: 'Listar tenants',
    description: 'SUPER_ADMIN: todos los tenants. Otros roles: solo su tenant.',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar por estado (solo SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'Lista de tenants obtenida exitosamente' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('active') active?: string,
  ) {
    // SUPER_ADMIN puede ver todos los tenants
    if (user.role === UserRole.SUPER_ADMIN) {
      let isActive: boolean | undefined;

      if (active === 'true') {
        isActive = true;
      } else if (active === 'false') {
        isActive = false;
      }

      const tenants = await this.tenantsService.findAll(isActive);

      return {
        success: true,
        message: 'Tenants obtenidos exitosamente',
        data: tenants,
        meta: {
          total: tenants.length,
          filter: { active: isActive ?? 'all' },
        },
      };
    }

    // Otros roles solo pueden ver su propio tenant
    if (!user.tenantId) {
      return {
        success: true,
        message: 'No tienes un tenant asignado',
        data: [],
        meta: { total: 0 },
      };
    }

    const tenant = await this.tenantsService.findById(user.tenantId);

    return {
      success: true,
      message: 'Tenant obtenido exitosamente',
      data: [tenant],
      meta: { total: 1 },
    };
  }

  /**
   * GET /tenants/count
   * Contar tenants activos (Solo SUPER_ADMIN)
   */
  @Get('count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Contar tenants activos (Solo SUPER_ADMIN)',
    description: 'Retorna el número total de tenants activos',
  })
  @ApiResponse({ status: 200, description: 'Conteo obtenido exitosamente' })
  @ApiResponse({ status: 403, description: 'No tienes permisos' })
  async count() {
    const total = await this.tenantsService.countActive();

    return {
      success: true,
      data: { total },
    };
  }

  /**
   * GET /tenants/check-slug/:slug
   * Verificar si un slug está disponible (Solo SUPER_ADMIN)
   */
  @Get('check-slug/:slug')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Verificar disponibilidad de slug (Solo SUPER_ADMIN)',
    description: 'Comprueba si un slug está disponible para usar',
  })
  @ApiParam({ name: 'slug', description: 'Slug a verificar', example: 'mi-empresa' })
  @ApiResponse({ status: 200, description: 'Resultado de la verificación' })
  async checkSlug(@Param('slug') slug: string) {
    const isAvailable = await this.tenantsService.isSlugAvailable(slug);

    return {
      success: true,
      data: { slug, isAvailable },
    };
  }

  /**
   * GET /tenants/by-slug/:slug
   * Obtener un Tenant por su slug
   */
  @Get('by-slug/:slug')
  @ApiOperation({ 
    summary: 'Obtener tenant por slug',
    description: 'SUPER_ADMIN: cualquier tenant. Otros: solo si es su tenant.',
  })
  @ApiParam({ name: 'slug', description: 'Slug único del tenant', example: 'agencia-digital-gt' })
  @ApiResponse({ status: 200, description: 'Tenant encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para ver este tenant' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenant = await this.tenantsService.findBySlug(slug);

    // Verificar permisos
    if (user.role !== UserRole.SUPER_ADMIN && tenant._id.toString() !== user.tenantId) {
      throw new ForbiddenException('No tienes permisos para ver este tenant');
    }

    return {
      success: true,
      data: tenant,
    };
  }

  /**
   * GET /tenants/:id
   * Obtener un Tenant por su ID
   */
  @Get(':id')
  @ApiOperation({ 
    summary: 'Obtener tenant por ID',
    description: 'SUPER_ADMIN: cualquier tenant. Otros: solo si es su tenant.',
  })
  @ApiParam({ name: 'id', description: 'ID único del tenant (ObjectId)', example: '507f1f77bcf86cd799439011' })
  @ApiResponse({ status: 200, description: 'Tenant encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para ver este tenant' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Verificar permisos antes de buscar
    if (user.role !== UserRole.SUPER_ADMIN && id !== user.tenantId) {
      throw new ForbiddenException('No tienes permisos para ver este tenant');
    }

    const tenant = await this.tenantsService.findById(id);

    return {
      success: true,
      data: tenant,
    };
  }

  /**
   * PUT /tenants/:id
   * Actualizar un Tenant completamente
   */
  @Put(':id')
  @ApiOperation({ 
    summary: 'Actualizar tenant (completo)',
    description: 'SUPER_ADMIN: cualquier tenant. TENANT_ADMIN: solo su tenant.',
  })
  @ApiParam({ name: 'id', description: 'ID único del tenant' })
  @ApiResponse({ status: 200, description: 'Tenant actualizado exitosamente' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para editar este tenant' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Solo SUPER_ADMIN o TENANT_ADMIN de ese tenant pueden editar
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (user.role !== UserRole.TENANT_ADMIN || id !== user.tenantId) {
        throw new ForbiddenException('No tienes permisos para editar este tenant');
      }
    }

    const tenant = await this.tenantsService.update(id, updateTenantDto);

    return {
      success: true,
      message: 'Tenant actualizado exitosamente',
      data: tenant,
    };
  }

  /**
   * PATCH /tenants/:id
   * Actualizar un Tenant parcialmente
   */
  @Patch(':id')
  @ApiOperation({ 
    summary: 'Actualizar tenant (parcial)',
    description: 'SUPER_ADMIN: cualquier tenant. TENANT_ADMIN: solo su tenant.',
  })
  @ApiParam({ name: 'id', description: 'ID único del tenant' })
  @ApiResponse({ status: 200, description: 'Tenant actualizado exitosamente' })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Solo SUPER_ADMIN o TENANT_ADMIN de ese tenant pueden editar
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (user.role !== UserRole.TENANT_ADMIN || id !== user.tenantId) {
        throw new ForbiddenException('No tienes permisos para editar este tenant');
      }
    }

    const tenant = await this.tenantsService.update(id, updateTenantDto);

    return {
      success: true,
      message: 'Tenant actualizado exitosamente',
      data: tenant,
    };
  }

  /**
   * PATCH /tenants/:id/deactivate
   * Desactivar un Tenant (Solo SUPER_ADMIN)
   */
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Desactivar tenant (Solo SUPER_ADMIN)',
    description: 'Desactiva un tenant sin eliminarlo (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'ID único del tenant' })
  @ApiResponse({ status: 200, description: 'Tenant desactivado exitosamente' })
  @ApiResponse({ status: 403, description: 'No tienes permisos' })
  async deactivate(@Param('id') id: string) {
    const tenant = await this.tenantsService.deactivate(id);

    return {
      success: true,
      message: 'Tenant desactivado exitosamente',
      data: tenant,
    };
  }

  /**
   * PATCH /tenants/:id/reactivate
   * Reactivar un Tenant (Solo SUPER_ADMIN)
   */
  @Patch(':id/reactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Reactivar tenant (Solo SUPER_ADMIN)',
    description: 'Reactiva un tenant previamente desactivado',
  })
  @ApiParam({ name: 'id', description: 'ID único del tenant' })
  @ApiResponse({ status: 200, description: 'Tenant reactivado exitosamente' })
  @ApiResponse({ status: 403, description: 'No tienes permisos' })
  async reactivate(@Param('id') id: string) {
    const tenant = await this.tenantsService.reactivate(id);

    return {
      success: true,
      message: 'Tenant reactivado exitosamente',
      data: tenant,
    };
  }

  /**
   * DELETE /tenants/:id
   * Eliminar un Tenant permanentemente (Solo SUPER_ADMIN)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Eliminar tenant (Solo SUPER_ADMIN)',
    description: '⚠️ CUIDADO: Elimina permanentemente un tenant. Esta acción es irreversible.',
  })
  @ApiParam({ name: 'id', description: 'ID único del tenant' })
  @ApiResponse({ status: 200, description: 'Tenant eliminado exitosamente' })
  @ApiResponse({ status: 403, description: 'No tienes permisos' })
  async remove(@Param('id') id: string) {
    await this.tenantsService.remove(id);

    return {
      success: true,
      message: 'Tenant eliminado exitosamente',
    };
  }
}