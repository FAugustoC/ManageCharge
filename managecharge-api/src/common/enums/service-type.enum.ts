/**
 * Tipos de servicio que un tenant puede ofrecer a sus clientes
 */
export enum ServiceType {
  /** Desarrollo de software a medida */
  SOFTWARE = 'software',
  
  /** Desarrollo de sitios web */
  WEBSITE = 'website',
  
  /** Campañas de posicionamiento SEO */
  SEO = 'seo',
  
  /** Gestión de redes sociales */
  SOCIAL_MEDIA = 'social_media',
  
  /** Servicios de hosting web */
  HOSTING = 'hosting',
  
  /** Registro y renovación de dominios */
  DOMAIN = 'domain',
  
  /** Mantenimiento y soporte técnico */
  MAINTENANCE = 'maintenance',
  
  /** Otros servicios no categorizados */
  OTHER = 'other',
}