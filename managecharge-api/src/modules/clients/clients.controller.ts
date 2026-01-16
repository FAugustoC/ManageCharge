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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service.js';
import { CreateClientDto, UpdateClientDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/guards/index.js';
import { CurrentUser } from '../../common/index.js';

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
 * ClientsController
 * 
 * @description Controlador REST para gestionar Clients.
 * Todos los endpoints requieren autenticación y filtran
 * automáticamente por el tenant del usuario autenticado.
 * 
 * Base URL: /api/v1/clients
 */
@ApiTags('Clients')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * POST /clients
   * Crear un nuevo Client
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo cliente',
    description: 'Registra un nuevo cliente para el tenant del usuario autenticado',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un cliente con ese email',
  })
  async create(
    @Body() createClientDto: CreateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.create(
      createClientDto,
      user.tenantId!,
      user.userId,
    );

    return {
      success: true,
      message: 'Cliente creado exitosamente',
      data: client,
    };
  }

  /**
   * GET /clients
   * Obtener todos los Clients del tenant
   */
  @Get()
  @ApiOperation({
    summary: 'Listar clientes',
    description: 'Obtiene todos los clientes del tenant del usuario autenticado',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar por estado: true (activos), false (inactivos). No enviar para ver todos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('active') active?: string,
  ) {
    let isActive: boolean | undefined;

    if (active === 'true') {
      isActive = true;
    } else if (active === 'false') {
      isActive = false;
    }

    const clients = await this.clientsService.findAllByTenant(
      user.tenantId!,
      isActive,
    );

    return {
      success: true,
      message: 'Clientes obtenidos exitosamente',
      data: clients,
      meta: {
        total: clients.length,
        filter: {
          active: isActive ?? 'all',
        },
      },
    };
  }

  /**
   * GET /clients/search
   * Buscar clientes por nombre
   */
  @Get('search')
  @ApiOperation({
    summary: 'Buscar clientes por nombre',
    description: 'Busca clientes activos cuyo nombre contenga el término de búsqueda',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Término de búsqueda',
    example: 'restaurante',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultados de búsqueda',
  })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') searchTerm: string,
  ) {
    const clients = await this.clientsService.searchByName(
      searchTerm,
      user.tenantId!,
    );

    return {
      success: true,
      data: clients,
      meta: {
        total: clients.length,
        searchTerm,
      },
    };
  }

  /**
   * GET /clients/count
   * Contar clientes del tenant
   */
  @Get('count')
  @ApiOperation({
    summary: 'Contar clientes',
    description: 'Retorna el número de clientes del tenant',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar por estado: true (activos), false (inactivos). No enviar para contar todos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo obtenido exitosamente',
  })
  async count(
    @CurrentUser() user: AuthenticatedUser,
    @Query('active') active?: string,
  ) {
    let isActive: boolean | undefined;

    if (active === 'true') {
      isActive = true;
    } else if (active === 'false') {
      isActive = false;
    }

    const total = await this.clientsService.countByTenant(
      user.tenantId!,
      isActive,
    );

    return {
      success: true,
      data: {
        total,
        filter: {
          active: isActive ?? 'all',
        },
      },
    };
  }

  /**
   * GET /clients/by-email/:email
   * Obtener un Client por su email
   */
  @Get('by-email/:email')
  @ApiOperation({
    summary: 'Buscar cliente por email',
    description: 'Busca un cliente por su email dentro del tenant',
  })
  @ApiParam({
    name: 'email',
    description: 'Email del cliente',
    example: 'cliente@empresa.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente encontrado o no encontrado',
  })
  async findByEmail(
    @Param('email') email: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.findByEmail(email, user.tenantId!);

    if (!client) {
      return {
        success: false,
        message: 'Cliente no encontrado',
        data: null,
      };
    }

    return {
      success: true,
      data: client,
    };
  }

  /**
   * GET /clients/:id
   * Obtener un Client por su ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener cliente por ID',
    description: 'Busca un cliente por su ID dentro del tenant',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.findById(id, user.tenantId!);

    return {
      success: true,
      data: client,
    };
  }

  /**
   * PUT /clients/:id
   * Actualizar un Client completamente
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar cliente (completo)',
    description: 'Actualiza todos los datos de un cliente',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está en uso por otro cliente',
  })
  async update(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.update(
      id,
      updateClientDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: client,
    };
  }

  /**
   * PATCH /clients/:id
   * Actualizar un Client parcialmente
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar cliente (parcial)',
    description: 'Actualiza solo los campos enviados',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente actualizado exitosamente',
  })
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.update(
      id,
      updateClientDto,
      user.tenantId!,
    );

    return {
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: client,
    };
  }

  /**
   * PATCH /clients/:id/deactivate
   * Desactivar un Client
   */
  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar cliente',
    description: 'Desactiva un cliente sin eliminarlo (soft delete)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente desactivado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.deactivate(id, user.tenantId!);

    return {
      success: true,
      message: 'Cliente desactivado exitosamente',
      data: client,
    };
  }

  /**
   * PATCH /clients/:id/reactivate
   * Reactivar un Client
   */
  @Patch(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivar cliente',
    description: 'Reactiva un cliente previamente desactivado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente reactivado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async reactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.reactivate(id, user.tenantId!);

    return {
      success: true,
      message: 'Cliente reactivado exitosamente',
      data: client,
    };
  }

  /**
   * DELETE /clients/:id
   * Eliminar un Client permanentemente
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar cliente',
    description: '⚠️ CUIDADO: Elimina permanentemente un cliente. Esta acción es irreversible.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.clientsService.remove(id, user.tenantId!);

    return {
      success: true,
      message: 'Cliente eliminado exitosamente',
    };
  }
}