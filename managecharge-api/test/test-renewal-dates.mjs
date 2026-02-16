// test-renewal-dates.mjs
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://managecharge_admin:managecharge_secret_2024@localhost:27017/managecharge?authSource=admin';
const TENANT_ID = '6990175676633bf231305060';

await mongoose.connect(MONGO_URI);

const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

// Simular: 
// - Suscripción venció el 10 de Febrero
// - Hoy es 17 de Febrero (día 7 de grace period)
await Tenant.findByIdAndUpdate(
  TENANT_ID,
  {
    $set: {
      'subscription.currentPeriodStart': new Date('2026-01-10T00:00:00.000Z'),
      'subscription.currentPeriodEnd': new Date('2026-02-10T00:00:00.000Z'),  // ← Venció hace 7 días
      'subscription.status': 'active',
      'subscription.plan': 'premium_monthly',
      'subscription.autoRenew': true,
      'subscription.retryAttempts': 0,
    }
  }
);

console.log('✅ Tenant configurado:');
console.log('   Periodo: 10 Enero - 10 Febrero (VENCIÓ hace 7 días)');
console.log('   Hoy: 16 Febrero');
console.log('   Cuando renueve, el nuevo periodo debe ser: 10 Feb - 10 Mar');

await mongoose.disconnect();