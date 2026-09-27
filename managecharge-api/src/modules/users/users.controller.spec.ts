import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole, AuthProvider } from '../../common/enums/index';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/index';

/**
 * Pruebas de autorización del UsersController
 *
 * @description Verifican que ningún usuario pueda:
 * - Crear o asignarse el rol SUPER_ADMIN
 * - Ver o modificar usuarios de otro tenant
 * - Cambiar su propio rol o tenant sin permiso
 *
 * El UsersService se reemplaza por un "mock" (objeto falso) para probar
 * SOLO las reglas del controlador, sin necesitar MongoDB.
 *
 * Ejecutar: npm test -- users.controller
 */

// ------------------------------------------------------------
// Datos de prueba
// ------------------------------------------------------------
const TENANT_A = new Types.ObjectId().toString();
const TENANT_B = new Types.ObjectId().toString();

/** Crea un usuario falso con la forma de un UserDocument */
function makeUser(role: UserRole, tenantId: string | null) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    role,
    tenantId: tenantId ? new Types.ObjectId(tenantId) : undefined,
    email: `${id.toString()}@test.com`,
  };
}

/** Convierte un usuario falso en el objeto que llega en request.user */
function asAuth(user: ReturnType<typeof makeUser>): AuthenticatedUser {
  return {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    tenantId: user.tenantId?.toString() ?? null,
  };
}

const superAdmin = makeUser(UserRole.SUPER_ADMIN, null);
const adminA = makeUser(UserRole.TENANT_ADMIN, TENANT_A);
const userA = makeUser(UserRole.TENANT_USER, TENANT_A);
const otherUserA = makeUser(UserRole.TENANT_USER, TENANT_A);
const adminB = makeUser(UserRole.TENANT_ADMIN, TENANT_B);
const userB = makeUser(UserRole.TENANT_USER, TENANT_B);

const allUsers = [superAdmin, adminA, userA, otherUserA, adminB, userB];

const baseCreateDto = {
  email: 'nuevo@test.com',
  password: 'Password123',
  firstName: 'Nuevo',
  lastName: 'Usuario',
};

describe('UsersController - autorización', () => {
  let controller: UsersController;
  // Cada método del servicio se reemplaza por una función falsa (jest.fn)
  let service: Partial<Record<keyof UsersService, jest.Mock>>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockImplementation(async (dto) => dto),
      findAll: jest.fn().mockResolvedValue(allUsers),
      findAllByTenant: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockImplementation(async (id: string) => {
        const found = allUsers.find((u) => u._id.toString() === id);
        if (!found) throw new NotFoundException();
        return found;
      }),
      findByEmail: jest.fn(),
      countByTenant: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async (_id, dto) => dto),
      deactivate: jest.fn().mockResolvedValue({}),
      reactivate: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue(undefined),
      tenantExists: jest.fn().mockResolvedValue(true),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  // ------------------------------------------------------------
  describe('Metadata de roles (@Roles)', () => {
    const rolesOf = (method: keyof UsersController) =>
      Reflect.getMetadata(ROLES_KEY, UsersController.prototype[method]);

    it('TENANT_USER no tiene acceso a crear, listar ni eliminar', () => {
      for (const method of ['create', 'findAll', 'remove', 'deactivate'] as const) {
        expect(rolesOf(method)).not.toContain(UserRole.TENANT_USER);
      }
    });

    it('todos los endpoints declaran roles explícitamente', () => {
      const methods = [
        'create', 'findAll', 'findByTenant', 'findByEmail', 'countByTenant',
        'findById', 'update', 'partialUpdate', 'deactivate', 'reactivate', 'remove',
      ] as const;
      for (const method of methods) {
        expect(rolesOf(method)?.length).toBeGreaterThan(0);
      }
    });
  });

  // ------------------------------------------------------------
  describe('POST /users', () => {
    it('nadie puede crear un SUPER_ADMIN, ni siquiera un super admin', async () => {
      for (const actor of [superAdmin, adminA]) {
        await expect(
          controller.create(
            { ...baseCreateDto, role: UserRole.SUPER_ADMIN },
            asAuth(actor),
          ),
        ).rejects.toThrow(ForbiddenException);
      }
      expect(service.create).not.toHaveBeenCalled();
    });

    it('TENANT_ADMIN siempre crea en SU tenant aunque envíe otro tenantId', async () => {
      await controller.create(
        { ...baseCreateDto, tenantId: TENANT_B },
        asAuth(adminA),
      );
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A }),
      );
    });

    it('fuerza registro LOCAL (no se pueden pre-registrar cuentas OAuth)', async () => {
      await controller.create(
        {
          ...baseCreateDto,
          authProvider: AuthProvider.GOOGLE,
          providerId: 'google-id-de-otra-persona',
        },
        asAuth(adminA),
      );
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authProvider: AuthProvider.LOCAL,
          providerId: undefined,
        }),
      );
    });

    it('SUPER_ADMIN debe indicar un tenant existente', async () => {
      await expect(
        controller.create(baseCreateDto, asAuth(superAdmin)),
      ).rejects.toThrow(BadRequestException);

      service.tenantExists!.mockResolvedValueOnce(false);
      await expect(
        controller.create(
          { ...baseCreateDto, tenantId: TENANT_A },
          asAuth(superAdmin),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ------------------------------------------------------------
  describe('GET /users', () => {
    it('TENANT_ADMIN solo recibe usuarios de su tenant', async () => {
      await controller.findAll(asAuth(adminA));
      expect(service.findAll).not.toHaveBeenCalled();
      expect(service.findAllByTenant).toHaveBeenCalledWith(TENANT_A, undefined);
    });

    it('SUPER_ADMIN recibe todos', async () => {
      await controller.findAll(asAuth(superAdmin));
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  describe('Consultas por tenant y email', () => {
    it('TENANT_ADMIN no puede consultar otro tenant', async () => {
      await expect(
        controller.findByTenant(TENANT_B, asAuth(adminA)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.countByTenant(TENANT_B, asAuth(adminA)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('by-email oculta usuarios de otros tenants', async () => {
      service.findByEmail!.mockResolvedValue(userB);
      const result = await controller.findByEmail(userB.email, asAuth(adminA));
      expect(result.data).toBeNull();
    });
  });

  // ------------------------------------------------------------
  describe('GET /users/:id', () => {
    it('TENANT_USER puede ver su propio perfil', async () => {
      const result = await controller.findById(userA._id.toString(), asAuth(userA));
      expect(result.data).toBe(userA);
    });

    it('TENANT_USER no puede ver a un compañero', async () => {
      await expect(
        controller.findById(otherUserA._id.toString(), asAuth(userA)),
      ).rejects.toThrow(NotFoundException);
    });

    it('TENANT_ADMIN no puede ver usuarios de otro tenant (404, no 403)', async () => {
      await expect(
        controller.findById(userB._id.toString(), asAuth(adminA)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ------------------------------------------------------------
  describe('PATCH /users/:id (escalada de privilegios)', () => {
    it('TENANT_USER no puede asignarse SUPER_ADMIN', async () => {
      await expect(
        controller.partialUpdate(
          userA._id.toString(),
          { role: UserRole.SUPER_ADMIN },
          asAuth(userA),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_USER no puede asignarse TENANT_ADMIN', async () => {
      await expect(
        controller.partialUpdate(
          userA._id.toString(),
          { role: UserRole.TENANT_ADMIN },
          asAuth(userA),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_USER no puede moverse a otro tenant', async () => {
      await expect(
        controller.partialUpdate(
          userA._id.toString(),
          { tenantId: TENANT_B },
          asAuth(userA),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_USER sí puede cambiar su nombre', async () => {
      await controller.partialUpdate(
        userA._id.toString(),
        { firstName: 'Ana María' },
        asAuth(userA),
      );
      expect(service.update).toHaveBeenCalledWith(userA._id.toString(), {
        firstName: 'Ana María',
      });
    });

    it('TENANT_ADMIN no puede promover a SUPER_ADMIN', async () => {
      await expect(
        controller.partialUpdate(
          userA._id.toString(),
          { role: UserRole.SUPER_ADMIN },
          asAuth(adminA),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_ADMIN no puede mover usuarios a otro tenant', async () => {
      await expect(
        controller.partialUpdate(
          userA._id.toString(),
          { tenantId: TENANT_B },
          asAuth(adminA),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_ADMIN no puede quitarse su propio rol de admin', async () => {
      await expect(
        controller.partialUpdate(
          adminA._id.toString(),
          { role: UserRole.TENANT_USER },
          asAuth(adminA),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_ADMIN puede promover a un usuario de su tenant a admin', async () => {
      await controller.partialUpdate(
        userA._id.toString(),
        { role: UserRole.TENANT_ADMIN },
        asAuth(adminA),
      );
      expect(service.update).toHaveBeenCalled();
    });

    it('SUPER_ADMIN no puede quitarle el rol a otro super admin por aquí', async () => {
      await expect(
        controller.partialUpdate(
          superAdmin._id.toString(),
          { role: UserRole.TENANT_USER },
          asAuth(superAdmin),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ------------------------------------------------------------
  describe('Desactivar / eliminar', () => {
    it('TENANT_ADMIN no puede eliminar usuarios de otro tenant', async () => {
      await expect(
        controller.remove(userB._id.toString(), asAuth(adminA)),
      ).rejects.toThrow(NotFoundException);
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('nadie puede desactivarse a sí mismo', async () => {
      await expect(
        controller.deactivate(adminA._id.toString(), asAuth(adminA)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN no puede eliminar super admins desde /users', async () => {
      const otherSuper = makeUser(UserRole.SUPER_ADMIN, null);
      allUsers.push(otherSuper);
      await expect(
        controller.remove(otherSuper._id.toString(), asAuth(superAdmin)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TENANT_ADMIN sí puede desactivar un usuario de su tenant', async () => {
      await controller.deactivate(userA._id.toString(), asAuth(adminA));
      expect(service.deactivate).toHaveBeenCalledWith(userA._id.toString());
    });
  });
});
