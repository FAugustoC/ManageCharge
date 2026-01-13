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
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CreateUserDto, UpdateUserDto } from './dto/index.js';

/**
 * UsersController
 * 
 * @description Controlador REST para gestionar Users.
 * 
 * Base URL: /api/v1/users
 * 
 * Nota: En producción, la mayoría de estos endpoints
 * estarán protegidos por guards de autenticación y roles.
 * Lo implementaremos en el AuthModule.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * POST /users
   * Crear un nuevo User
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description: 'Registra un nuevo usuario en el sistema',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está registrado',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);

    return {
      success: true,
      message: 'Usuario creado exitosamente',
      data: user,
    };
  }

  /**
   * GET /users
   * Obtener todos los Users (solo SUPER_ADMIN)
   */
  @Get()
  @ApiOperation({
    summary: 'Listar todos los usuarios',
    description: 'Obtiene todos los usuarios del sistema (solo SUPER_ADMIN)',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar por estado: true (activos), false (inactivos), no enviar nada (todos)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
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

    const users = await this.usersService.findAll(isActive);

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
  @ApiOperation({
    summary: 'Listar usuarios de un tenant',
    description: 'Obtiene todos los usuarios de un tenant específico',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'ID del tenant',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar por estado: true (activos), false (inactivos), no enviar nada (todos)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios del tenant obtenida exitosamente',
  })
  async findByTenant(
    @Param('tenantId') tenantId: string,
    @Query('active') active?: string,
  ) {
    let isActive: boolean | undefined;
    
    if (active === 'true') {
      isActive = true;
    } else if (active === 'false') {
      isActive = false;
    }

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
  @ApiOperation({
    summary: 'Buscar usuario por email',
    description: 'Busca un usuario usando su email',
  })
  @ApiParam({
    name: 'email',
    description: 'Email del usuario',
    example: 'usuario@ejemplo.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
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
  @ApiOperation({
    summary: 'Contar usuarios de un tenant',
    description: 'Retorna el número total de usuarios activos de un tenant',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'ID del tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo obtenido exitosamente',
  })
  async countByTenant(@Param('tenantId') tenantId: string) {
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
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Busca un usuario usando su ID de MongoDB',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);

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
  @ApiOperation({
    summary: 'Actualizar usuario (completo)',
    description: 'Actualiza los datos de un usuario',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);

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
  @ApiOperation({
    summary: 'Actualizar usuario (parcial)',
    description: 'Actualiza solo los campos enviados',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);

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
  @ApiOperation({
    summary: 'Desactivar usuario',
    description: 'Desactiva un usuario sin eliminarlo (soft delete)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario desactivado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async deactivate(@Param('id') id: string) {
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
  @ApiOperation({
    summary: 'Reactivar usuario',
    description: 'Reactiva un usuario previamente desactivado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario reactivado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async reactivate(@Param('id') id: string) {
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar usuario',
    description: '⚠️ CUIDADO: Elimina permanentemente un usuario',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);

    return {
      success: true,
      message: 'Usuario eliminado exitosamente',
    };
  }
}