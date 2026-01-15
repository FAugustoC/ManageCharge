import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Public } from './common/index.js';

/**
 * AppController
 * 
 * @description Controlador principal con endpoints de health check
 */
@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   * Health check básico
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'API funcionando correctamente' })
  getHealth() {
    return this.appService.getHealth();
  }

  /**
   * GET /info
   * Información de la API
   */
  @Public()
  @Get('info')
  @ApiOperation({ summary: 'Información de la API' })
  @ApiResponse({ status: 200, description: 'Información del proyecto' })
  getInfo() {
    return this.appService.getInfo();
  }
}