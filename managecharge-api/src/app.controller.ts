import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';

/**
 * AppController - Endpoints de prueba y health check
 */
@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check del API' })
  @ApiResponse({ status: 200, description: 'API funcionando correctamente' })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('info')
  @ApiOperation({ summary: 'Información de la API' })
  @ApiResponse({ status: 200, description: 'Información del sistema' })
  getInfo() {
    return this.appService.getInfo();
  }
}