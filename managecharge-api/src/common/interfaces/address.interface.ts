/**
 * Interfaz para direcciones
 */
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Información bancaria del tenant
 */
export interface BankInfo {
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  accountHolder?: string;
  routingNumber?: string;
  notes?: string;
}