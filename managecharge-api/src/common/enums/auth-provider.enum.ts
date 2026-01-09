/**
 * Proveedores de autenticación OAuth
 */
export enum AuthProvider {
  /** Autenticación local con email/password */
  LOCAL = 'local',
  
  /** Google OAuth 2.0 */
  GOOGLE = 'google',
  
  /** Apple Sign In */
  APPLE = 'apple',
}