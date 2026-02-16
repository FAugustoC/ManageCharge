// Script: test-cron-setup.mjs
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://managecharge_admin:managecharge_secret_2024@localhost:27017/managecharge?authSource=admin';
const TENANT_ID = '6990175676633bf231305060'; // ID de tu tenant de prueba

await mongoose.connect(MONGO_URI);

const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // Hace 1 hora

const result = await Tenant.findByIdAndUpdate(
  TENANT_ID,
  {
    $set: {
      // ✅ Periodo que VENCIÓ hace 1 hora
      'subscription.currentPeriodStart': new Date('2026-01-16T00:00:00.000Z'),
      'subscription.currentPeriodEnd': oneHourAgo,  // ← Hace 1 hora
      'subscription.status': 'active',
      'subscription.plan': 'premium_monthly',
      'subscription.autoRenew': true,
      'subscription.retryAttempts': 0,
      // ✅ Ya tienes método de pago válido
      'subscription.paymentMethod.paymentMethodId': 'pm_1T1LH1BjFTEirbEilw833GGA',
      'subscription.paymentMethod.customerId': 'cus_TzJvB5mLQPN8Ws',
      'subscription.paymentMethod.provider': 'stripe',
      'subscription.paymentMethod.last4': '4242',
      'subscription.paymentMethod.brand': 'visa',
      'subscription.paymentMethod.expiryMonth': 2,
      'subscription.paymentMethod.expiryYear': 2027,
    }
  },
  { new: true }
);

console.log('✅ Tenant actualizado:');
console.log('   ID:', result._id);
console.log('   Plan:', result.subscription.plan);
console.log('   Status:', result.subscription.status);
console.log('   Period Start:', result.subscription.currentPeriodStart);
console.log('   Period End:', result.subscription.currentPeriodEnd);
console.log('   ¿Vencido?:', new Date(result.subscription.currentPeriodEnd) < new Date() ? 'SÍ ✅' : 'NO ❌');
console.log('   Auto-renew:', result.subscription.autoRenew);
console.log('   Payment Method:', `**** ${result.subscription.paymentMethod.last4}`);

await mongoose.disconnect();