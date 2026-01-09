import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador @Public()
 * 
 * Marca un endpoint como público (no requiere autenticación).
 * 
 * @example
 * @Public()
 * @Post('login')
 * login(@Body() loginDto: LoginDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);