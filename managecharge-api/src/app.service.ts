import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AppService - Servicio principal
 */
@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHealth() {
    return {
      success: true,
      message: 'ManageCharge API está funcionando correctamente',
      timestamp: new Date().toISOString(),
    };
  }

  getInfo() {
    return {
      name: this.configService.get<string>('app.name'),
      version: '1.0.0',
      description: 'Sistema de gestión de cobros y clientes',
      objective: 'Que un usuario pueda registrar un cliente y nunca olvidar cobrarle',
      environment: this.configService.get<string>('app.env'),
      features: {
        mvp: [
          'Gestión de clientes',
          'Servicios recurrentes y únicos',
          'Control de fechas de cobro',
          'Abonos y pagos parciales',
          'Estados automáticos (pendiente/pagado/vencido)',
          'Notificaciones por Email',
          'Notificaciones por WhatsApp (próximamente)',
          'Historial por cliente',
          'OAuth (Google/Apple Sign In)',
        ],
        comingSoon: [
          'Pasarela de pagos online',
          'Dashboard con gráficos',
          'Reportes avanzados',
          'App móvil',
        ],
      },
    };
  }
}