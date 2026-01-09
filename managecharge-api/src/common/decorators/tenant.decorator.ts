import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador @TenantId()
 * 
 * Extrae el tenantId del usuario autenticado.
 * 
 * @example
 * @Get()
 * findAll(@TenantId() tenantId: string) {
 *   return this.clientsService.findAllByTenant(tenantId);
 * }
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId ?? null;
  },
);