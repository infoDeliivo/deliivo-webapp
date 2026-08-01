'use client';

import { ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export function isStripeConfigured() {
  return Boolean(STRIPE_PK);
}

/**
 * True only when the app is wired to a Stripe test key. Used to gate test-only affordances such as
 * the payout form's "fill test data" shortcut: with a live key this is false, so those controls
 * cannot reach production however the build is configured.
 */
export function isStripeTestMode() {
  return STRIPE_PK.startsWith('pk_test_');
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise && STRIPE_PK) {
    stripePromise = loadStripe(STRIPE_PK);
  }
  return stripePromise;
}

export function StripeProvider({ children }: { children: ReactNode }) {
  const stripe = getStripe();
  return (
    <Elements stripe={stripe ?? null} options={{ appearance: { theme: 'stripe' } }}>
      {children}
    </Elements>
  );
}
