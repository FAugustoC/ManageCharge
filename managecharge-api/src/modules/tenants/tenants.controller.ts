import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, } from '@nestjs/swagger';

import { TenantsService } from './tenants.service.js';
import { CreateTenantDto, UpdateTenantDto } from './dto/index.js';

/**
 * TenantsController
 * 
 * @description Controlador REST para gestionar Tenants.
 * Define los endpoints HTTP disponibles para operaciones CRUD.
 * 
 * Base URL: /api/v1/tenants
 */
@ApiTags('Tenants') // Agrupa los endpoints en Swagger bajo "Tenants"
@Controller('tenants') // Define la ruta base: /tenants
export class TenantsController {
  /**
   * Constructor con inyección del servicio
   * 
   * @param tenantsService - Servicio inyectado automáticamente por NestJS
   */
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * POST /tenants
   * Crear un nuevo Tenant
   */
  @Post()
  @HttpCode(HttpStatus.CREATED) // Retorna 201 en vez de 200
  @ApiOperation({ 
    summary: 'Crear un nuevo tenant',
    description: 'Registra una nueva empresa o freelancer en ManageCharge',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Tenant creado exitosamente',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({ 
    status: 409, 
    description: 'El slug o email ya están en uso',
  })
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
   * Obtener todos los Tenants
   */
  @Get()
  @ApiOperation({ 
    summary: 'Listar todos los tenants',
    description: 'Obtiene la lista de todos los tenants registrados',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar por estado: true (activos), false (inactivos), no enviar nada (todos)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de tenants obtenida exitosamente',
  })
  async findAll(@Query('active') active?: string) {
    // Convertir string a boolean o undefined
    let isActive: boolean | undefined;

    if (active === 'true') {
      isActive = true;
    } else if (active === 'false') {
      isActive = false;
    }
    // Si es 'all' o no se envía, isActive queda undefined (mostrar todos)

    const tenants = await this.tenantsService.findAll(isActive);

    return {
      success: true,
      message: 'Tenants obtenidos exitosamente',
      data: tenants,
      meta: {
        total: tenants.length,
        filter: {
          active: isActive ?? 'all',
        },
      },
    };
  }

  /**
   * GET /tenants/count
   * Contar tenants activos
   */
  @Get('count')
  @ApiOperation({ 
    summary: 'Contar tenants activos',
    description: 'Retorna el número total de tenants activos',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Conteo obtenido exitosamente',
  })
  async count() {
    const total = await this.tenantsService.countActive();

    return {
      success: true,
      data: {
        total,
      },
    };
  }

  /**
   * GET /tenants/check-slug/:slug
   * Verificar si un slug está disponible
   */
  @Get('check-slug/:slug')
  @ApiOperation({ 
    summary: 'Verificar disponibilidad de slug',
    description: 'Comprueba si un slug está disponible para usar',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug a verificar',
    example: 'mi-empresa',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Resultado de la verificación',
  })
  async checkSlug(@Param('slug') slug: string) {
    const isAvailable = await this.tenantsService.isSlugAvailable(slug);

    return {
      success: true,
      data: {
        slug,
        isAvailable,
      },
    };
  }

  /**
   * GET /tenants/by-slug/:slug
   * Obtener un Tenant por su slug
   */
  @Get('by-slug/:slug')
  @ApiOperation({ 
    summary: 'Obtener tenant por slug',
    description: 'Busca un tenant usando su slug único',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug único del tenant',
    example: 'agencia-digital-gt',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant encontrado',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant no encontrado',
  })
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findBySlug(slug);

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
    description: 'Busca un tenant usando su ID de MongoDB',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del tenant (ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant encontrado',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant no encontrado',
  })
  async findById(@Param('id') id: string) {
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
    description: 'Actualiza todos los campos de un tenant',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del tenant',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant actualizado exitosamente',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant no encontrado',
  })
  @ApiResponse({ 
    status: 409, 
    description: 'El slug o email ya están en uso',
  })
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
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
   * 
   * @description PUT y PATCH hacen lo mismo aquí porque
   * UpdateTenantDto ya tiene todos los campos opcionales.
   * La diferencia es semántica (REST conventions).
   */
  @Patch(':id')
  @ApiOperation({ 
    summary: 'Actualizar tenant (parcial)',
    description: 'Actualiza solo los campos enviados',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del tenant',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant actualizado exitosamente',
  })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantsService.update(id, updateTenantDto);

    return {
      success: true,
      message: 'Tenant actualizado exitosamente',
      data: tenant,
    };
  }

  /**
   * PATCH /tenants/:id/deactivate
   * Desactivar un Tenant
   */
  @Patch(':id/deactivate')
  @ApiOperation({ 
    summary: 'Desactivar tenant',
    description: 'Desactiva un tenant sin eliminarlo (soft delete)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del tenant',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant desactivado exitosamente',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant no encontrado',
  })
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
   * Reactivar un Tenant
   */
  @Patch(':id/reactivate')
  @ApiOperation({ 
    summary: 'Reactivar tenant',
    description: 'Reactiva un tenant previamente desactivado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del tenant',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant reactivado exitosamente',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant no encontrado',
  })
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
   * Eliminar un Tenant permanentemente
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Eliminar tenant',
    description: '⚠️ CUIDADO: Elimina permanentemente un tenant. Esta acción es irreversible.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del tenant',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant eliminado exitosamente',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant no encontrado',
  })
  async remove(@Param('id') id: string) {
    await this.tenantsService.remove(id);

    return {
      success: true,
      message: 'Tenant eliminado exitosamente',
    };
  }
}