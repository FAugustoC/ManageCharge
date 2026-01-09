/**
 * Canales de notificación disponibles
 */
export enum NotificationChannel {
  /** Notificación por correo electrónico */
  EMAIL = 'email',
  
  /** Notificación por WhatsApp Business API */
  WHATSAPP = 'whatsapp',
  
  /** Notificación por SMS (futuro) */
  SMS = 'sms',
}

/**
 * Estados de una notificación
 */
export enum NotificationStatus {
  /** Programada para envío futuro */
  SCHEDULED = 'scheduled',
  
  /** Enviada exitosamente */
  SENT = 'sent',
  
  /** Falló el envío */
  FAILED = 'failed',
  
  /** Cancelada antes de enviar */
  CANCELLED = 'cancelled',
}