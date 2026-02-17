// test-downgrade-setup.mjs
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://managecharge_admin:managecharge_secret_2024@localhost:27017/managecharge?authSource=admin';
const TENANT_ID = '6990175676633bf231305060';

await mongoose.connect(MONGO_URI);

const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

await Tenant.findByIdAndUpdate(
  TENANT_ID,
  {
    $set: {
      // ✅ Estado: Grace period con 7 intentos agotados
      'subscription.status': 'grace_period',
      'subscription.retryAttempts': 7,  // ← Máximo alcanzado
      'subscription.plan': 'premium_monthly',
      'subscription.currentPeriodEnd': new Date('2026-02-10T00:00:00.000Z'),  // Vencido
      'subscription.autoRenew': true,
      'subscription.lastRetryDate': new Date(),
      
      // Mantener método de pago (para auditoría)
      'subscription.paymentMethod.provider': 'stripe',
      'subscription.paymentMethod.customerId': 'cus_TzJvB5mLQPN8Ws',
      'subscription.paymentMethod.paymentMethodId': 'pm_1T1LH1BjFTEirbEilw833GGA',
      'subscription.paymentMethod.last4': '4242',
      'subscription.paymentMethod.brand': 'visa',
    }
  }
);

console.log('✅ Tenant configurado para downgrade:');
console.log('   Status: grace_period');
console.log('   Retry Attempts: 7/7 (agotados)');
console.log('   Plan actual: premium_monthly');
console.log('   Al ejecutar cron de downgrade → Pasará a FREE');

await mongoose.disconnect();