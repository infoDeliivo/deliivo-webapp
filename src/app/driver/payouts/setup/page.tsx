'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, FileText, FlaskConical, Landmark, Loader2, ShieldCheck, Upload, Wallet } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadFailureCard from '@/components/LoadFailureCard';
import { ConnectAccountOnboarding } from '@stripe/react-connect-js';
import { ConnectProvider, createBankAccountToken } from '@/lib/stripe-connect';
import { isStripeConfigured, isStripeTestMode } from '@/lib/stripe';
import { ApiError, ConnectRequirements, getApiErrorMessage, paymentsApi, validateStripeIdentityDocument } from '@/lib/api';
import { showError, showSuccess } from '@/lib/app-feedback';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n-context';

const DEFAULT_RETURN_TO = '/profile/earnings';

// Payouts are single-country, matching the backend's STRIPE_CONNECT_COUNTRY. Both values are sent
// to Stripe when tokenising the bank account, so they have to agree with the connected account's
// own country — a mismatch is rejected outright.
// Fallbacks only, used before the requirements response has arrived. The connected account's
// real country and currency come from that response: Stripe fixes them when the account is
// created and rejects an address or bank account from anywhere else, so hardcoding them breaks
// every driver whose account was opened in another country.
const FALLBACK_COUNTRY = 'EE';
const FALLBACK_CURRENCY = 'eur';

/**
 * Stripe's documented test values (https://docs.stripe.com/connect/testing). They are the only
 * inputs that verify in test mode — a realistic-looking name, address or IBAN leaves the account
 * stuck in `currently_due`, which reads as a bug in our own flow.
 *
 *   line1 address_full_match -> successful address match
 *   EE382200221020145685  -> payout succeeds
 *
 * Stripe also documents dob 1901-01-01 as the successful date-of-birth match, but our
 * own validator caps age at MAXIMUM_AGE_YEARS (120, stripe.connect.validator.ts), so
 * that value is rejected as "Date of birth is not valid" before the request leaves us.
 * A plain adult DOB is used instead: it is not the special match trigger, but it passes
 * both sides and Stripe accepts any real DOB over 13.
 *
 * Only reachable with a pk_test_ key; see isStripeTestMode().
 */
const STRIPE_TEST_VALUES = {
  firstName: 'Test',
  lastName: 'Driver',
  email: 'test-driver@example.com',
  phone: '+37255512345',
  dob: '2000-01-01',
  line1: 'address_full_match',
  line2: '',
  city: 'Tallinn',
  postalCode: '10123',
  accountHolderName: 'Test Driver',
  accountNumber: 'EE382200221020145685',
} as const;

// Only same-origin paths — a `returnTo` of `//evil.example` or `https://evil.example` would
// otherwise turn this page into an open redirect.
function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_TO;
  return value;
}

type FieldErrors = Record<string, string>;

/**
 * Stripe names the field it rejected as `individual[address][postal_code]`; the backend validator
 * names it `address.postalCode`. Both are normalised to the form's own field names so a rejection
 * lands under the input that caused it instead of in a page-level banner.
 */
function toFieldName(param: string): string {
  const segments = param
    .replace(/\]/g, '')
    .split(/[[.]/)
    .filter(Boolean)
    .filter((segment) => segment !== 'individual');

  const path = segments.map((segment) =>
    segment.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  );

  // Stripe reports the dob as three separate fields; the form has a single input for all of them.
  if (path[0] === 'dob') return 'dob';
  return path.join('.');
}

function readFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};

  const data = error.data as
    | {
        errors?: { field?: string; message?: string }[];
        error?: { param?: string; message?: string };
      }
    | undefined;

  const fieldErrors: FieldErrors = {};

  for (const issue of data?.errors ?? []) {
    if (issue.field && issue.message) fieldErrors[toFieldName(issue.field)] = issue.message;
  }

  if (data?.error?.param && data.error.message) {
    fieldErrors[toFieldName(data.error.param)] = data.error.message;
  }

  return fieldErrors;
}

function requirementLabel(requirement: string) {
  const labels: Record<string, string> = {
    external_account: 'Bank account',
    'tos_acceptance.date': 'Stripe agreement acceptance',
    'tos_acceptance.ip': 'Stripe agreement acceptance',
    'individual.first_name': 'Legal first name',
    'individual.last_name': 'Legal last name',
    'individual.email': 'Email',
    'individual.phone': 'Phone number',
    'individual.dob.day': 'Date of birth',
    'individual.dob.month': 'Date of birth',
    'individual.dob.year': 'Date of birth',
    'individual.address.line1': 'Address',
    'individual.address.city': 'City',
    'individual.address.postal_code': 'Post code',
    'individual.address.country': 'Country',
    'individual.verification.document': 'Identity document',
    'individual.verification.document.front': 'Identity document front',
    'individual.verification.document.back': 'Identity document back',
  };
  return labels[requirement] || requirement.replace(/^individual\./, '').replace(/[._]/g, ' ');
}

export default function PayoutSetupPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-deliivo-cream flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-deliivo-orange" />
          </div>
        }
      >
        <PayoutSetupContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function PayoutSetupContent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const [requirements, setRequirements] = useState<ConnectRequirements | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [exiting, setExiting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [identityDocument, setIdentityDocument] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Prefill from the profile the driver already completed — the same values the backend sends to
  // Stripe when it creates the account, so the form opens showing what Stripe already holds.
  //
  // Adjusted during render rather than in an effect: the profile arrives asynchronously from the
  // auth context, and seeding it from an effect would render an empty form first and then discard
  // it, which React 19 flags as a cascading render. Keyed on the user id so a driver's own edits
  // are never overwritten by a later re-render.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (user && prefilledFor !== user.id) {
    setPrefilledFor(user.id);
    setFirstName((current) => current || user.firstName || '');
    setLastName((current) => current || user.lastName || '');
    setEmail((current) => current || user.email || '');
    setPhone((current) => current || user.phone || '');
    setDob((current) => current || (user.dob ? user.dob.slice(0, 10) : ''));
    setAccountHolderName(
      (current) => current || [user.firstName, user.lastName].filter(Boolean).join(' ')
    );
  }

  // Nothing is set before the first await: a synchronous setState here would run inside the mount
  // effect below and cascade an extra render.
  const loadRequirements = useCallback(async () => {
    try {
      const res = await paymentsApi.connectRequirements();
      setRequirements(res.data);
      setLoadError('');
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, t('profile.payoutSetupFailed'));
      setLoadError(message);
      showError(t('profile.payoutSetupError'), message);
    }
  }, [t]);

  useEffect(() => {
    if (!isStripeConfigured()) return;
    void (async () => {
      await loadRequirements();
    })();
  }, [loadRequirements]);

  // A driver returning to a half-finished setup should not be asked again for what Stripe already
  // accepted, so each section is driven by what is still outstanding rather than by a fixed order.
  const outstanding = useMemo(() => {
    const due = new Set([...(requirements?.currentlyDue ?? []), ...(requirements?.pastDue ?? [])]);
    const dueList = [...due];
    return {
      details: dueList.some((entry) => entry.startsWith('individual') && !entry.startsWith('individual.verification.document')),
      bank: due.has('external_account') || !requirements?.externalAccount,
      document: dueList.some((entry) => entry.startsWith('individual.verification.document')),
      terms:
        dueList.some((entry) => entry.startsWith('tos_acceptance')) ||
        !requirements?.termsAccepted,
    };
  }, [requirements]);

  const identityDocumentSide: 'front' | 'back' = useMemo(() => {
    const due = [...(requirements?.currentlyDue ?? []), ...(requirements?.pastDue ?? [])];
    return due.some((entry) => entry.includes('individual.verification.document.back')) ? 'back' : 'front';
  }, [requirements]);

  const documentPendingVerification = Boolean(
    requirements?.pendingVerification.some((entry) => entry.startsWith('individual.verification.document'))
  );
  const dueRequirements = useMemo(
    () => Array.from(new Set([...(requirements?.currentlyDue ?? []), ...(requirements?.pastDue ?? [])])),
    [requirements]
  );
  const pendingRequirements = requirements?.pendingVerification ?? [];

  const hasActionableRequirements = outstanding.details || outstanding.bank || outstanding.document || outstanding.terms;

  const complete = Boolean(
    requirements && requirements.payoutsEnabled && requirements.currentlyDue.length === 0
  );

  const payoutCountry = requirements?.country?.toUpperCase() || FALLBACK_COUNTRY;
  const payoutCurrency = requirements?.defaultCurrency || FALLBACK_CURRENCY;

  // An account Stripe collects requirements for cannot be filled in through this form; those
  // drivers finish in Stripe's own onboarding instead.
  const stripeManaged = requirements?.requirementCollection === 'stripe';

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (saving) return;

      setSaving(true);
      setFieldErrors({});

      try {
        let latest = requirements;

        if (outstanding.details) {
          const res = await paymentsApi.connectSaveDetails({
            firstName,
            lastName,
            email,
            phone: phone.trim() ? phone.trim() : null,
            dob,
            address: {
              line1,
              line2: line2.trim() ? line2.trim() : null,
              city,
              postalCode,
              country: payoutCountry,
            },
          });
          latest = res.data;
          setRequirements(latest);
        }

        if (outstanding.bank) {
          // Tokenised in the browser: the account number never reaches Deliivo's server.
          const token = await createBankAccountToken({
            country: payoutCountry,
            currency: payoutCurrency,
            accountNumber,
            accountHolderName,
          });
          const res = await paymentsApi.connectAddBankAccount(token);
          latest = res.data;
          setRequirements(latest);
          setAccountNumber('');
        }

        if (outstanding.document) {
          if (!identityDocument) {
            setFieldErrors({ identityDocument: t('payout.identityDocumentRequired') });
            return;
          }
          const invalid = validateStripeIdentityDocument(identityDocument);
          if (invalid) {
            setFieldErrors({ identityDocument: invalid });
            return;
          }
          const res = await paymentsApi.connectUploadIdentityDocument(identityDocument, identityDocumentSide);
          latest = res.data;
          setRequirements(latest);
          setIdentityDocument(null);
        }

        if (outstanding.terms) {
          const res = await paymentsApi.connectAcceptTerms();
          latest = res.data;
          setRequirements(latest);
        }

        if (latest?.payoutsEnabled && latest.currentlyDue.length === 0) {
          showSuccess(t('payout.readyTitle'), t('payout.readyCopy'));
        } else if (latest?.pendingVerification.some((entry) => entry.startsWith('individual.verification.document'))) {
          showSuccess(t('payout.identityDocumentPendingTitle'), t('payout.identityDocumentPendingCopy'));
        } else {
          // Stripe can ask for more once it has seen the first answers (an ID document, say).
          showSuccess(t('payout.savedTitle'), t('payout.savedCopy'));
        }
      } catch (err: unknown) {
        setFieldErrors(readFieldErrors(err));
        showError(t('payout.saveFailed'), getApiErrorMessage(err, t('payout.saveFailed')));
      } finally {
        setSaving(false);
      }
    },
    [
      accountHolderName,
      accountNumber,
      city,
      payoutCountry,
      payoutCurrency,
      dob,
      email,
      firstName,
      identityDocument,
      identityDocumentSide,
      lastName,
      line1,
      line2,
      outstanding,
      phone,
      postalCode,
      requirements,
      saving,
      t,
    ]
  );

  const fillTestValues = useCallback(() => {
    setFieldErrors({});
    setFirstName(STRIPE_TEST_VALUES.firstName);
    setLastName(STRIPE_TEST_VALUES.lastName);
    setEmail(STRIPE_TEST_VALUES.email);
    setPhone(STRIPE_TEST_VALUES.phone);
    setDob(STRIPE_TEST_VALUES.dob);
    setLine1(STRIPE_TEST_VALUES.line1);
    setLine2(STRIPE_TEST_VALUES.line2);
    setCity(STRIPE_TEST_VALUES.city);
    setPostalCode(STRIPE_TEST_VALUES.postalCode);
    setAccountHolderName(STRIPE_TEST_VALUES.accountHolderName);
    setAccountNumber(STRIPE_TEST_VALUES.accountNumber);
    setAcceptedTerms(true);
  }, []);

  const handleExit = useCallback(async () => {
    setExiting(true);
    // GET /status is what flips stripeOnboardingComplete server-side, so it has to run before we
    // navigate back to a page that gates on that flag.
    try {
      await paymentsApi.connectStatus();
    } catch {
      // Status refresh is best-effort — the destination page reloads it on mount anyway.
    }
    router.push(returnTo);
  }, [returnTo, router]);

  const chrome = (body: React.ReactNode) => (
    <div className="min-h-screen bg-deliivo-cream">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center gap-3 sm:px-6">
        <Link
          href={returnTo}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-deliivo-orange transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 ml-2">{t('profile.payoutSetupTitle')}</h1>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">{body}</main>
    </div>
  );

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors[name]}</p>
    ) : null;

  if (!isStripeConfigured()) {
    return chrome(
      <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">{t('profile.stripeKeyRequired')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('profile.stripeKeyRequiredCopy')}</p>
      </section>
    );
  }

  if (loadError) {
    return chrome(
      <LoadFailureCard
        title={t('profile.payoutSetupTitle')}
        message={loadError}
        onRetry={loadRequirements}
      />
    );
  }

  if (!requirements) {
    return chrome(
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-deliivo-gray">
        <Loader2 className="h-5 w-5 animate-spin text-deliivo-orange" />
        {t('profile.payoutSetupLoading')}
      </div>
    );
  }

  if (complete) {
    return chrome(
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t('payout.readyTitle')}</h2>
            <p className="mt-1 text-sm text-deliivo-gray">{t('payout.readyCopy')}</p>
            {requirements.externalAccount && (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                <Landmark className="h-4 w-4 text-deliivo-gray" />
                {requirements.externalAccount.bankName || t('payout.bankAccount')} ••••{' '}
                {requirements.externalAccount.last4}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleExit}
          disabled={exiting}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-deliivo-orange px-4 py-2 text-sm font-semibold text-white hover:bg-deliivo-orange-dark disabled:opacity-50"
        >
          {exiting && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('profile.payoutSetupDone')}
        </button>
      </section>
    );
  }

  // Nothing on this account is ours to write, so the custom form would only produce a 409 on
  // submit. Stripe's embedded onboarding is the one path that still works for these drivers.
  if (stripeManaged) {
    return chrome(
      <>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">{t('payout.stripeManagedCopy')}</p>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <ConnectProvider>
            <ConnectAccountOnboarding
              onExit={handleExit}
              collectionOptions={{ fields: 'currently_due', futureRequirements: 'omit' }}
              onLoadError={({ error: loadError }) => {
                showError(
                  t('profile.payoutSetupError'),
                  loadError.message || t('profile.payoutSetupLoadError')
                );
              }}
            />
          </ConnectProvider>
        </section>
      </>
    );
  }

  return chrome(
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">{t('payout.countryNoticeTitle')}</span>{' '}
          {t('payout.countryNoticeCopy', { country: payoutCountry })}
        </p>
      </section>

      {isStripeTestMode() && (
        <section className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-indigo-900">
              <span className="font-semibold">{t('payout.testModeTitle')}</span>{' '}
              {t('payout.testModeCopy')}
            </p>
            <button
              type="button"
              onClick={fillTestValues}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <FlaskConical className="h-4 w-4" />
              {t('payout.testFill')}
            </button>
          </div>
        </section>
      )}

      {/* Stripe can raise an issue against a value it already accepted (a name that fails
          verification, say). It is shown here because it belongs to no single input. */}
      {requirements.errors.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('payout.stripeIssuesTitle')}</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
            {requirements.errors.map((issue) => (
              <li key={`${issue.requirement}-${issue.code}`}>{issue.reason}</li>
            ))}
          </ul>
        </section>
      )}

      {outstanding.details && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">{t('payout.personalTitle')}</h2>
          <p className="mt-1 text-sm text-deliivo-gray">{t('payout.personalCopy')}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.firstName')} *
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input-field"
              />
              {fieldError('firstName')}
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.lastName')} *
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input-field"
              />
              {fieldError('lastName')}
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.email')} *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
              {fieldError('email')}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.phone')}
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="+372 5551 2345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
              />
              <p className="mt-1 text-xs text-deliivo-gray">{t('payout.phoneHint')}</p>
              {fieldError('phone')}
            </div>

            <div>
              <label
                htmlFor="dob"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.dob')} *
              </label>
              <input
                id="dob"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input-field"
              />
              {fieldError('dob')}
            </div>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-gray-900">{t('payout.addressTitle')}</h3>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="line1"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.addressLine1')} *
              </label>
              <input
                id="line1"
                type="text"
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="input-field"
              />
              {fieldError('address.line1')}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="line2"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.addressLine2')}
              </label>
              <input
                id="line2"
                type="text"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                className="input-field"
              />
              {fieldError('address.line2')}
            </div>

            <div>
              <label
                htmlFor="city"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.city')} *
              </label>
              <input
                id="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input-field"
              />
              {fieldError('address.city')}
            </div>

            <div>
              <label
                htmlFor="postalCode"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.postalCode')} *
              </label>
              <input
                id="postalCode"
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="input-field"
              />
              {fieldError('address.postalCode')}
            </div>

            <div>
              <label
                htmlFor="country"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.country')}
              </label>
              <input
                id="country"
                type="text"
                value={payoutCountry}
                readOnly
                disabled
                className="input-field bg-gray-50 text-deliivo-gray"
              />
              {fieldError('address.country')}
            </div>
          </div>
        </section>
      )}

      {outstanding.bank && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Wallet className="h-4 w-4 text-deliivo-orange" />
            {t('payout.bankTitle')}
          </h2>
          <p className="mt-1 text-sm text-deliivo-gray">{t('payout.bankCopy')}</p>

          <div className="mt-4 grid gap-4">
            <div>
              <label
                htmlFor="accountHolderName"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.accountHolder')} *
              </label>
              <input
                id="accountHolderName"
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="accountNumber"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
              >
                {t('payout.iban')} *
              </label>
              <input
                id="accountNumber"
                type="text"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="EE38 2200 2210 2014 5685"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                className="input-field font-mono tracking-wide"
              />
              <p className="mt-1 flex items-center gap-1.5 text-xs text-deliivo-gray">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {t('payout.ibanPrivacy')}
              </p>
              {fieldError('token')}
            </div>
          </div>
        </section>
      )}

      {!outstanding.bank && requirements.externalAccount && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">{t('payout.bankTitle')}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-900">
            <Landmark className="h-4 w-4 text-deliivo-gray" />
            {requirements.externalAccount.bankName || t('payout.bankAccount')} ••••{' '}
            {requirements.externalAccount.last4}
          </p>
        </section>
      )}

      {outstanding.document && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-deliivo-orange" />
            {t('payout.identityDocumentTitle')}
          </h2>
          <p className="mt-1 text-sm text-deliivo-gray">
            {identityDocumentSide === 'back'
              ? t('payout.identityDocumentBackCopy')
              : t('payout.identityDocumentCopy')}
          </p>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-6 text-center hover:bg-orange-50">
            <Upload className="h-6 w-6 text-deliivo-orange" />
            <span className="mt-2 text-sm font-semibold text-deliivo-dark">
              {identityDocument ? identityDocument.name : t('payout.identityDocumentChoose')}
            </span>
            <span className="mt-1 text-xs text-deliivo-gray">{t('payout.identityDocumentHint')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (!file) {
                  setIdentityDocument(null);
                  return;
                }
                const invalid = validateStripeIdentityDocument(file);
                if (invalid) {
                  setFieldErrors({ identityDocument: invalid });
                  setIdentityDocument(null);
                  event.target.value = '';
                  return;
                }
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.identityDocument;
                  return next;
                });
                setIdentityDocument(file);
              }}
            />
          </label>
          {fieldError('identityDocument')}
        </section>
      )}

      {(dueRequirements.length > 0 || pendingRequirements.length > 0 || (!requirements.payoutsEnabled && !hasActionableRequirements)) && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('payout.stripeStatusTitle')}</h2>
          {dueRequirements.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase text-deliivo-gray">{t('payout.stillRequired')}</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-deliivo-dark">
                {dueRequirements.map((entry) => (
                  <li key={entry}>{requirementLabel(entry)}</li>
                ))}
              </ul>
            </div>
          )}
          {pendingRequirements.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase text-deliivo-gray">{t('payout.pendingReview')}</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-deliivo-dark">
                {pendingRequirements.map((entry) => (
                  <li key={entry}>{requirementLabel(entry)}</li>
                ))}
              </ul>
            </div>
          )}
          {dueRequirements.length === 0 && pendingRequirements.length === 0 && !requirements.payoutsEnabled && (
            <p className="mt-2 text-sm text-deliivo-gray">{t('payout.waitingStripeEnablement')}</p>
          )}
        </section>
      )}

      {documentPendingVerification && !outstanding.document && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-950">{t('payout.identityDocumentPendingTitle')}</h2>
          <p className="mt-1 text-sm text-amber-900">{t('payout.identityDocumentPendingCopy')}</p>
        </section>
      )}

      {outstanding.terms && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <label htmlFor="acceptedTerms" className="flex items-start gap-3 text-sm text-gray-900">
            <input
              id="acceptedTerms"
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-deliivo-orange focus:ring-deliivo-orange"
            />
            <span>{t('payout.termsCopy')}</span>
          </label>
        </section>
      )}

      {hasActionableRequirements ? (
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-deliivo-orange px-4 py-3 text-sm font-semibold text-white hover:bg-deliivo-orange-dark disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? t('payout.submitting') : t('payout.submit')}
        </button>
      ) : (
        <button
          type="button"
          onClick={loadRequirements}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-deliivo-orange hover:bg-orange-50"
        >
          {t('payout.refreshStatus')}
        </button>
      )}
    </form>
  );
}
