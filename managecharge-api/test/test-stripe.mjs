// test-stripe.mjs
import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51Sz8tlBjFTEirbEiI6FHZQ9lxDaL2ZcaI2YYtqUtocoidA5abuZqf2Nmelj0eiAbQ0iHfygpCw5cYrLGhhZuUBqP00T1KGN5YI');

async function createTestPaymentMethods() {
  console.log('Creando PaymentMethods de prueba...\n');

  // ✅ Tarjeta exitosa - Usando token predefinido de Stripe
  const pmSuccess = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      token: 'tok_visa', // ← Token predefinido de Stripe (no número real)
    },
  });

  // ❌ Tarjeta siempre rechazada
  const pmDeclined = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      token: 'tok_chargeDeclined',
    },
  });

  // ❌ Fondos insuficientes
  const pmInsufficient = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      token: 'tok_chargeDeclinedInsufficientFunds',
    },
  });

  // ✅ Esta tarjeta se ADJUNTA pero FALLA al cobrar por fondos insuficientes
  const pmInsufficientFunds = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      token: 'tok_chargeDeclinedInsufficientFunds',
    },
  });

  console.log('💳 Token para fondos insuficientes (falla al cobrar):');
  console.log(`   PaymentMethod ID: ${pmInsufficientFunds.id}`);

  console.log('=== TOKENS GENERADOS ===\n');

  console.log('✅ Cobro exitoso (tok_visa):');
  console.log(`   PaymentMethod ID: ${pmSuccess.id}`);
  console.log(`   Marca: ${pmSuccess.card.brand}`);
  console.log(`   Últimos 4: ${pmSuccess.card.last4}\n`);

  console.log('❌ Siempre rechazada (tok_chargeDeclined):');
  console.log(`   PaymentMethod ID: ${pmDeclined.id}`);
  console.log(`   Últimos 4: ${pmDeclined.card.last4}\n`);

  console.log('❌ Fondos insuficientes:');
  console.log(`   PaymentMethod ID: ${pmInsufficient.id}`);
  console.log(`   Últimos 4: ${pmInsufficient.card.last4}\n`);

  console.log('=== COPIA ESTOS VALORES PARA SWAGGER ===\n');

  console.log('📋 Prueba EXITOSA:');
  console.log(JSON.stringify({
    plan: 'premium_monthly',
    paymentMethodToken: pmSuccess.id,
  }, null, 2));

  console.log('\n📋 Prueba FALLIDA (rechazo):');
  console.log(JSON.stringify({
    plan: 'premium_monthly',
    paymentMethodToken: pmDeclined.id,
  }, null, 2));

  console.log('\n📋 Prueba FALLIDA (fondos insuficientes):');
  console.log(JSON.stringify({
    plan: 'premium_monthly',
    paymentMethodToken: pmInsufficient.id,
  }, null, 2));
}

createTestPaymentMethods().catch(console.error);