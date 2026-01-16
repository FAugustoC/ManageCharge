import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client, ClientDocument } from './entities/index.js';
import { CreateClientDto, UpdateClientDto } from './dto/index.js';

/**
 * ClientsService
 * 
 * @description Servicio que contiene toda la lógica de negocio
 * relacionada con los Clients (clientes de cada tenant).
 * 
 * Responsabilidades:
 * - CRUD de clientes
 * - Aislamiento por tenant (cada tenant solo ve sus clientes)
 * - Validaciones de negocio (email único por tenant, etc.)
 */
@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
  ) {}

  /**
   * Crear un nuevo Client
   * 
   * @param createClientDto - Datos validados del nuevo cliente
   * @param tenantId - ID del tenant (desde el token JWT)
   * @param userId - ID del usuario que crea (desde el token JWT)
   * @returns El cliente creado
   * @throws ConflictException si el email ya existe en el tenant
   */
  async create(
    createClientDto: CreateClientDto,
    tenantId: string,
    userId: string,
  ): Promise<ClientDocument> {
    // Verificar si el email ya existe en este tenant
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      email: createClientDto.email.toLowerCase(),
    };

    const existingClient = await this.clientModel.findOne(filter).exec();

    if (existingClient) {
      throw new ConflictException(
        `Ya existe un cliente con el email "${createClientDto.email}" en tu cuenta`,
      );
    }

    // Crear el nuevo cliente
    const newClient = new this.clientModel({
      ...createClientDto,
      email: createClientDto.email.toLowerCase(),
      tenantId: new Types.ObjectId(tenantId),
      createdBy: new Types.ObjectId(userId),
    });

    return newClient.save();
  }

  /**
   * Obtener todos los Clients de un Tenant
   * 
   * @param tenantId - ID del tenant
   * @param isActive - true: solo activos, false: solo inactivos, undefined: todos
   * @returns Lista de clientes del tenant
   */
  async findAllByTenant(
    tenantId: string,
    isActive?: boolean,
  ): Promise<ClientDocument[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
    };

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    return this.clientModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtener un Client por su ID
   * 
   * @param id - ID del cliente
   * @param tenantId - ID del tenant (para verificar pertenencia)
   * @returns El cliente encontrado
   * @throws NotFoundException si no existe o no pertenece al tenant
   */
  async findById(id: string, tenantId: string): Promise<ClientDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    };

    const client = await this.clientModel.findOne(filter).exec();

    if (!client) {
      throw new NotFoundException(`Cliente con ID "${id}" no encontrado`);
    }

    return client;
  }

  /**
   * Obtener un Client por su email dentro de un Tenant
   * 
   * @param email - Email del cliente
   * @param tenantId - ID del tenant
   * @returns El cliente encontrado o null
   */
  async findByEmail(
    email: string,
    tenantId: string,
  ): Promise<ClientDocument | null> {
    const filter: Record<string, unknown> = {
      email: email.toLowerCase(),
      tenantId: new Types.ObjectId(tenantId),
    };

    return this.clientModel.findOne(filter).exec();
  }

  /**
   * Buscar clientes por nombre (búsqueda parcial)
   * 
   * @param searchTerm - Término de búsqueda
   * @param tenantId - ID del tenant
   * @returns Lista de clientes que coinciden
   */
  async searchByName(
    searchTerm: string,
    tenantId: string,
  ): Promise<ClientDocument[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      name: { $regex: searchTerm, $options: 'i' },
      isActive: true,
    };

    return this.clientModel
      .find(filter)
      .sort({ name: 1 })
      .limit(20)
      .exec();
  }

  /**
   * Actualizar un Client
   * 
   * @param id - ID del cliente a actualizar
   * @param updateClientDto - Datos a actualizar
   * @param tenantId - ID del tenant (para verificar pertenencia)
   * @returns El cliente actualizado
   * @throws NotFoundException si no existe
   * @throws ConflictException si el nuevo email ya existe
   */
  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    tenantId: string,
  ): Promise<ClientDocument> {
    // Verificar que el cliente existe y pertenece al tenant
    const existingClient = await this.findById(id, tenantId);

    // Si se quiere cambiar el email, verificar que no esté en uso
    if (
      updateClientDto.email &&
      updateClientDto.email.toLowerCase() !== existingClient.email
    ) {
      const emailFilter: Record<string, unknown> = {
        email: updateClientDto.email.toLowerCase(),
        tenantId: new Types.ObjectId(tenantId),
        _id: { $ne: new Types.ObjectId(id) },
      };

      const emailInUse = await this.clientModel.findOne(emailFilter).exec();

      if (emailInUse) {
        throw new ConflictException(
          `Ya existe un cliente con el email "${updateClientDto.email}" en tu cuenta`,
        );
      }
    }

    // Preparar datos para actualizar
    const updateData: Record<string, unknown> = { ...updateClientDto };
    if (updateData.email) {
      updateData.email = (updateData.email as string).toLowerCase();
    }

    // Actualizar y retornar
    const updatedClient = await this.clientModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true },
      )
      .exec();

    if (!updatedClient) {
      throw new NotFoundException(`Cliente con ID "${id}" no encontrado`);
    }

    return updatedClient;
  }

  /**
   * Desactivar un Client (soft delete)
   * 
   * @param id - ID del cliente a desactivar
   * @param tenantId - ID del tenant
   * @returns El cliente desactivado
   */
  async deactivate(id: string, tenantId: string): Promise<ClientDocument> {
    // Verificar que existe y pertenece al tenant
    await this.findById(id, tenantId);

    const deactivatedClient = await this.clientModel
      .findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      )
      .exec();

    return deactivatedClient!;
  }

  /**
   * Reactivar un Client
   * 
   * @param id - ID del cliente a reactivar
   * @param tenantId - ID del tenant
   * @returns El cliente reactivado
   */
  async reactivate(id: string, tenantId: string): Promise<ClientDocument> {
    // Verificar que existe y pertenece al tenant
    await this.findById(id, tenantId);

    const reactivatedClient = await this.clientModel
      .findByIdAndUpdate(
        id,
        { isActive: true },
        { new: true },
      )
      .exec();

    return reactivatedClient!;
  }

  /**
   * Eliminar un Client permanentemente
   * 
   * @param id - ID del cliente a eliminar
   * @param tenantId - ID del tenant
   * 
   * @description ⚠️ CUIDADO: Esta acción es irreversible.
   * Normalmente usamos deactivate() en su lugar.
   */
  async remove(id: string, tenantId: string): Promise<void> {
    // Verificar que existe y pertenece al tenant
    const client = await this.findById(id, tenantId);

    await this.clientModel.findByIdAndDelete(client._id).exec();
  }

  /**
   * Contar clientes de un tenant
   * 
   * @param tenantId - ID del tenant
   * @param isActive - true: solo activos, false: solo inactivos, undefined: todos
   * @returns Número de clientes
   */
  async countByTenant(tenantId: string, isActive?: boolean): Promise<number> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
    };

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    return this.clientModel.countDocuments(filter).exec();
  }
}