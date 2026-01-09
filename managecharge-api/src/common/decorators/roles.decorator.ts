import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/index.js';

export const ROLES_KEY = 'roles';

/**
 * Decorador @Roles()
 * 
 * @example
 * @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
 * @Get('admin-only')
 * adminEndpoint() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);