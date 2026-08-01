'use client';

import { getStripe } from './stripe';

/**
 * Bank account tokenisation for the custom payout onboarding form.
 *
 * The embedded Connect onboarding component used to live here too. It was removed when the
 * platform took over collecting requirements itself (the backend's /payments/connect/* endpoints);
 * the AccountSession endpoint is still there if an embedded flow is ever needed for requirements
 * the API cannot collect, such as identity documents.
 */

/**
 * Tokenises a bank account in the browser. The account number goes straight from this form to
 * Stripe — it never reaches Deliivo's server, which accepts only the resulting `btok_` token.
 *
 * `routingNumber` is US-only; SEPA countries carry everything in the IBAN, so it is omitted for
 * the single-country (EE) flow this form serves.
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
