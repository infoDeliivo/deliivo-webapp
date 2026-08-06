'use client';

import { ReactNode, useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectComponentsProvider } from '@stripe/react-connect-js';
import { paymentsApi } from './api';
import { getStripe } from './stripe';

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

/**
 * Two payout onboarding paths live here.
 *
 * The custom form the platform renders itself covers accounts it controls, and needs only
 * `createBankAccountToken` below. Accounts Stripe collects requirements for — anything opened
 * before the platform took that over — cannot be filled in through our API at all, so those
 * drivers get Stripe's embedded onboarding instead, which is what the provider is for.
 */

/**
 * connect-js calls this on load and again every time the client secret expires, so it must mint a
 * fresh AccountSession each time rather than reuse a cached one. The typings require a string, so
 * a missing secret throws — connect-js surfaces that through onLoadError.
 */
async function fetchClientSecret(): Promise<string> {
  const res = await paymentsApi.connectAccountSession();
  if (!res.data.clientSecret) {
    throw new Error('CONNECT_ACCOUNT_SESSION_UNAVAILABLE');
  }
  return res.data.clientSecret;
}

/**
 * The Connect instance is created per mount rather than in a module-level singleton: the session
 * is scoped to one connected account, so it must not survive a sign-out into the next user's.
 */
export function ConnectProvider({ children }: { children: ReactNode }) {
  const [connectInstance] = useState(() =>
    loadConnectAndInitialize({
      publishableKey: STRIPE_PK,
      fetchClientSecret,
      appearance: {
        overlays: 'dialog',
        variables: {
          colorPrimary: '#f97316',
          colorText: '#111827',
          colorBackground: '#ffffff',
          borderRadius: '12px',
          fontFamily: 'inherit',
        },
      },
    })
  );

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      {children}
    </ConnectComponentsProvider>
  );
}

/**
 * Tokenises a bank account in the browser. The account number goes straight from this form to
 * Stripe — it never reaches Deliivo's server, which accepts only the resulting `btok_` token.
 *
 * `routingNumber` is US-only; SEPA countries carry everything in the IBAN, so it is omitted for
 * supported European IBAN payout accounts.
 */
export async function createBankAccountToken(input: {
  country: string;
  currency: string;
  accountNumber: string;
  accountHolderName: string;
}): Promise<string> {
  const stripe = await getStripe();
  if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');

  const { token, error } = await stripe.createToken('bank_account', {
    country: input.country,
    currency: input.currency,
    account_number: input.accountNumber.replace(/\s+/g, ''),
    account_holder_name: input.accountHolderName,
    account_holder_type: 'individual',
  });

  // Stripe reports a bad IBAN here rather than throwing, and its message names the problem
  // ("The bank account number provided is invalid"), so it is worth surfacing verbatim.
  if (error || !token) throw new Error(error?.message || 'BANK_ACCOUNT_TOKEN_FAILED');

  return token.id;
}
