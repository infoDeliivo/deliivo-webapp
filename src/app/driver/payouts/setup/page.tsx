'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, FileText, FlaskConical, Landmark, Loader2, Pencil, ShieldCheck, Trash2, Upload, Wallet } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadFailureCard from '@/components/LoadFailureCard';
import { ConnectAccountOnboarding } from '@stripe/react-connect-js';
import { ConnectProvider, createBankAccountToken } from '@/lib/stripe-connect';
import { isStripeConfigured, isStripeTestMode } from '@/lib/stripe';
import { ApiError, ConnectRequirements, getApiErrorMessage, paymentsApi, STRIPE_IDENTITY_DOCUMENT_ACCEPT, validateStripeIdentityDocument } from '@/lib/api';
import { showError, showSuccess } from '@/lib/app-feedback';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n-context';

const DEFAULT_RETURN_TO = '/profile/earnings';

// Fallbacks only, used before the requirements response has arrived. The connected account's
// real country and currency come from that response: Stripe fixes them when the account is
// created and rejects an address or bank account from anywhere else.
const FALLBACK_COUNTRY = 'EE';
const FALLBACK_CURRENCY = 'eur';

const PAYOUT_COUNTRIES = [
  { code: 'AT', label: 'Austria', phoneExample: '+43 660 1234567', ibanExample: 'AT61 1904 3002 3457 3201', cityExample: 'Vienna', postalExample: '1010' },
  { code: 'BE', label: 'Belgium', phoneExample: '+32 470 12 34 56', ibanExample: 'BE68 5390 0754 7034', cityExample: 'Brussels', postalExample: '1000' },
  { code: 'BG', label: 'Bulgaria', phoneExample: '+359 88 812 3456', ibanExample: 'BG80 BNBG 9661 1020 3456 78', cityExample: 'Sofia', postalExample: '1000' },
  { code: 'HR', label: 'Croatia', phoneExample: '+385 91 123 4567', ibanExample: 'HR12 1001 0051 8630 0016 0', cityExample: 'Zagreb', postalExample: '10000' },
  { code: 'CY', label: 'Cyprus', phoneExample: '+357 96 123456', ibanExample: 'CY17 0020 0128 0000 0012 0052 7600', cityExample: 'Nicosia', postalExample: '1010' },
  { code: 'CZ', label: 'Czech Republic', phoneExample: '+420 601 123 456', ibanExample: 'CZ65 0800 0000 1920 0014 5399', cityExample: 'Prague', postalExample: '11000' },
  { code: 'DK', label: 'Denmark', phoneExample: '+45 20 12 34 56', ibanExample: 'DK50 0040 0440 1162 43', cityExample: 'Copenhagen', postalExample: '1050' },
  { code: 'EE', label: 'Estonia', phoneExample: '+372 5551 2345', ibanExample: 'EE38 2200 2210 2014 5685', cityExample: 'Tallinn', postalExample: '10123' },
  { code: 'FI', label: 'Finland', phoneExample: '+358 40 123 4567', ibanExample: 'FI21 1234 5600 0007 85', cityExample: 'Helsinki', postalExample: '00100' },
  { code: 'FR', label: 'France', phoneExample: '+33 6 12 34 56 78', ibanExample: 'FR14 2004 1010 0505 0001 3M02 606', cityExample: 'Paris', postalExample: '75001' },
  { code: 'DE', label: 'Germany', phoneExample: '+49 1512 3456789', ibanExample: 'DE89 3704 0044 0532 0130 00', cityExample: 'Berlin', postalExample: '10115' },
  { code: 'GI', label: 'Gibraltar', phoneExample: '+350 54012345', ibanExample: 'GI75 NWBK 0000 0000 7099 453', cityExample: 'Gibraltar', postalExample: 'GX11 1AA' },
  { code: 'GR', label: 'Greece', phoneExample: '+30 691 234 5678', ibanExample: 'GR16 0110 1250 0000 0001 2300 695', cityExample: 'Athens', postalExample: '10557' },
  { code: 'HU', label: 'Hungary', phoneExample: '+36 20 123 4567', ibanExample: 'HU42 1177 3016 1111 1018 0000 0000', cityExample: 'Budapest', postalExample: '1051' },
  { code: 'IE', label: 'Ireland', phoneExample: '+353 85 123 4567', ibanExample: 'IE29 AIBK 9311 5212 3456 78', cityExample: 'Dublin', postalExample: 'D01' },
  { code: 'IT', label: 'Italy', phoneExample: '+39 312 345 6789', ibanExample: 'IT60 X054 2811 1010 0000 0123 456', cityExample: 'Rome', postalExample: '00100' },
  { code: 'LV', label: 'Latvia', phoneExample: '+371 26 123 456', ibanExample: 'LV80 BANK 0000 4351 9500 1', cityExample: 'Riga', postalExample: 'LV-1050' },
  { code: 'LI', label: 'Liechtenstein', phoneExample: '+423 661 234 567', ibanExample: 'LI21 0881 0000 2324 013A A', cityExample: 'Vaduz', postalExample: '9490' },
  { code: 'LT', label: 'Lithuania', phoneExample: '+370 612 34567', ibanExample: 'LT12 1000 0111 0100 1000', cityExample: 'Vilnius', postalExample: '01100' },
  { code: 'LU', label: 'Luxembourg', phoneExample: '+352 621 123 456', ibanExample: 'LU28 0019 4006 4475 0000', cityExample: 'Luxembourg', postalExample: 'L-1111' },
  { code: 'MT', label: 'Malta', phoneExample: '+356 9912 3456', ibanExample: 'MT84 MALT 0110 0001 2345 MTLC AST0 01S', cityExample: 'Valletta', postalExample: 'VLT 1111' },
  { code: 'NL', label: 'Netherlands', phoneExample: '+31 6 12345678', ibanExample: 'NL91 ABNA 0417 1643 00', cityExample: 'Amsterdam', postalExample: '1011' },
  { code: 'NO', label: 'Norway', phoneExample: '+47 412 34 567', ibanExample: 'NO93 8601 1117 947', cityExample: 'Oslo', postalExample: '0150' },
  { code: 'PL', label: 'Poland', phoneExample: '+48 512 345 678', ibanExample: 'PL61 1090 1014 0000 0712 1981 2874', cityExample: 'Warsaw', postalExample: '00-001' },
  { code: 'PT', label: 'Portugal', phoneExample: '+351 912 345 678', ibanExample: 'PT50 0002 0123 1234 5678 9015 4', cityExample: 'Lisbon', postalExample: '1100-001' },
  { code: 'RO', label: 'Romania', phoneExample: '+40 712 345 678', ibanExample: 'RO49 AAAA 1B31 0075 9384 0000', cityExample: 'Bucharest', postalExample: '010011' },
  { code: 'SK', label: 'Slovakia', phoneExample: '+421 901 123 456', ibanExample: 'SK31 1200 0000 1987 4263 7541', cityExample: 'Bratislava', postalExample: '811 01' },
  { code: 'SI', label: 'Slovenia', phoneExample: '+386 40 123 456', ibanExample: 'SI56 1910 0000 0123 438', cityExample: 'Ljubljana', postalExample: '1000' },
  { code: 'ES', label: 'Spain', phoneExample: '+34 612 345 678', ibanExample: 'ES91 2100 0418 4502 0005 1332', cityExample: 'Madrid', postalExample: '28001' },
  { code: 'SE', label: 'Sweden', phoneExample: '+46 70 123 45 67', ibanExample: 'SE45 5000 0000 0583 9825 7466', cityExample: 'Stockholm', postalExample: '111 20' },
  { code: 'CH', label: 'Switzerland', phoneExample: '+41 76 123 45 67', ibanExample: 'CH93 0076 2011 6238 5295 7', cityExample: 'Zurich', postalExample: '8001' },
  { code: 'GB', label: 'United Kingdom', phoneExample: '+44 7700 900123', ibanExample: 'GB29 NWBK 6016 1331 9268 19', cityExample: 'London', postalExample: 'SW1A 1AA' },
] as const;

function countryMeta(country: string) {
  return PAYOUT_COUNTRIES.find((option) => option.code === country) || PAYOUT_COUNTRIES.find((option) => option.code === FALLBACK_COUNTRY)!;
}

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
  const [needsCountrySelection, setNeedsCountrySelection] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(FALLBACK_COUNTRY);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingBank, setDeletingBank] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [exiting, setExiting] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingBank, setEditingBank] = useState(false);

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
  const loadRequirements = useCallback(async (country?: string) => {
    try {
      const res = await paymentsApi.connectRequirements(country);
      setRequirements(res.data);
      setSelectedCountry(res.data.country?.toUpperCase() || country || FALLBACK_COUNTRY);
      setNeedsCountrySelection(false);
      setLoadError('');
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, t('profile.payoutSetupFailed'));
      setLoadError(message);
      showError(t('profile.payoutSetupError'), message);
    }
  }, [t]);

  const loadInitialPayoutSetup = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const status = await paymentsApi.connectStatus();
      if (isCancelled()) return;
      if (status.data.connected) {
        await loadRequirements();
      } else {
        setNeedsCountrySelection(true);
        setLoadError('');
      }
    } catch (err: unknown) {
      if (isCancelled()) return;
      const message = getApiErrorMessage(err, t('profile.payoutSetupFailed'));
      setLoadError(message);
      showError(t('profile.payoutSetupError'), message);
    }
  }, [loadRequirements, t]);

  useEffect(() => {
    if (!isStripeConfigured()) return;
    let cancelled = false;
    void loadInitialPayoutSetup(() => cancelled);
    return () => { cancelled = true; };
  }, [loadInitialPayoutSetup]);

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

  const showDetailsForm = outstanding.details || editingDetails;
  const showBankForm = outstanding.bank || editingBank;
  const hasActionableRequirements = showDetailsForm || showBankForm || outstanding.document || outstanding.terms;

  const complete = Boolean(
    requirements && requirements.payoutsEnabled && requirements.currentlyDue.length === 0
  );

  const payoutCountry = requirements?.country?.toUpperCase() || FALLBACK_COUNTRY;
  const payoutCurrency = requirements?.defaultCurrency || FALLBACK_CURRENCY;
  const payoutCountryMeta = countryMeta(payoutCountry);
  const selectedCountryMeta = countryMeta(selectedCountry);

  // An account Stripe collects requirements for cannot be filled in through this form; those
  // drivers finish in Stripe's own onboarding instead.
  const stripeManaged = requirements?.requirementCollection === 'stripe';

  const handleStartSetup = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingAccount) return;
    setCreatingAccount(true);
    await loadRequirements(selectedCountry);
    setCreatingAccount(false);
  }, [creatingAccount, loadRequirements, selectedCountry]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (saving) return;

      setSaving(true);
      setFieldErrors({});

      try {
        let latest = requirements;

        if (showDetailsForm) {
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
          setEditingDetails(false);
        }

        if (showBankForm) {
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
          setEditingBank(false);
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
      showBankForm,
      showDetailsForm,
      t,
    ]
  );

  const fillTestValues = useCallback(() => {
    setFieldErrors({});
    setFirstName(STRIPE_TEST_VALUES.firstName);
    setLastName(STRIPE_TEST_VALUES.lastName);
    setEmail(STRIPE_TEST_VALUES.email);
    setPhone(payoutCountryMeta.phoneExample);
    setDob(STRIPE_TEST_VALUES.dob);
    setLine1(STRIPE_TEST_VALUES.line1);
    setLine2(STRIPE_TEST_VALUES.line2);
    setCity(payoutCountryMeta.cityExample);
    setPostalCode(payoutCountryMeta.postalExample);
    setAccountHolderName(STRIPE_TEST_VALUES.accountHolderName);
    setAccountNumber(payoutCountryMeta.ibanExample);
    setAcceptedTerms(true);
  }, [payoutCountryMeta]);

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

  const handleDeleteBankAccount = useCallback(async () => {
    const externalAccountId = requirements?.externalAccount?.id;
    if (!externalAccountId || deletingBank) return;
    if (!window.confirm(t('payout.removeBankConfirm'))) return;

    setDeletingBank(true);
    try {
      const res = await paymentsApi.connectDeleteBankAccount(externalAccountId);
      setRequirements(res.data);
      setEditingBank(true);
      setAccountNumber('');
      showSuccess(t('payout.bankRemovedTitle'), t('payout.bankRemovedCopy'));
    } catch (err: unknown) {
      showError(t('payout.removeBankFailed'), getApiErrorMessage(err, t('payout.removeBankFailed')));
    } finally {
      setDeletingBank(false);
    }
  }, [deletingBank, requirements?.externalAccount?.id, t]);

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

  if (needsCountrySelection && !requirements) {
    return chrome(
      <form onSubmit={handleStartSetup} className="flex flex-col gap-5">
        {loadError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{loadError}</p>
          </section>
        )}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-deliivo-orange">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('payout.countrySelectTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-deliivo-gray">{t('payout.countrySelectCopy')}</p>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="payoutCountry"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray"
            >
              {t('payout.country')}
            </label>
            <select
              id="payoutCountry"
              value={selectedCountry}
              onChange={(event) => setSelectedCountry(event.target.value)}
              className="input-field"
            >
              {PAYOUT_COUNTRIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label} ({option.code})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-deliivo-gray">
              {t('payout.countrySelectHint', {
                country: selectedCountryMeta.label,
                iban: selectedCountryMeta.ibanExample,
              })}
            </p>
          </div>

          <button
            type="submit"
            disabled={creatingAccount}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-deliivo-orange px-4 py-3 text-sm font-semibold text-white hover:bg-deliivo-orange-dark disabled:opacity-50 sm:w-auto"
          >
            {creatingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
            {creatingAccount ? t('payout.countryCreating') : t('payout.countryContinue')}
          </button>
        </section>
      </form>
    );
  }

  if (loadError) {
    return chrome(
      <LoadFailureCard
        title={t('profile.payoutSetupTitle')}
        message={loadError}
        onRetry={() => loadInitialPayoutSetup()}
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

  if (complete && !editingDetails && !editingBank) {
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditingDetails(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-deliivo-orange hover:bg-orange-50"
          >
            <Pencil className="h-4 w-4" />
            {t('payout.editPersonalDetails')}
          </button>
          <button
            type="button"
            onClick={() => setEditingBank(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-deliivo-orange hover:bg-orange-50"
          >
            <Wallet className="h-4 w-4" />
            {t('payout.replaceBankAccount')}
          </button>
          {requirements.externalAccount && (
            <button
              type="button"
              onClick={handleDeleteBankAccount}
              disabled={deletingBank}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deletingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('payout.removeBankAccount')}
            </button>
          )}
          <button
            type="button"
            onClick={handleExit}
            disabled={exiting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-deliivo-orange px-4 py-2 text-sm font-semibold text-white hover:bg-deliivo-orange-dark disabled:opacity-50"
          >
            {exiting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('profile.payoutSetupDone')}
          </button>
        </div>
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

      {showDetailsForm && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">
            {editingDetails ? t('payout.editPersonalDetails') : t('payout.personalTitle')}
          </h2>
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
                placeholder={payoutCountryMeta.phoneExample}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
              />
              <p className="mt-1 text-xs text-deliivo-gray">{t('payout.phoneHint', { phone: payoutCountryMeta.phoneExample })}</p>
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
                value={`${payoutCountryMeta.label} (${payoutCountry})`}
                readOnly
                disabled
                className="input-field bg-gray-50 text-deliivo-gray"
              />
              {fieldError('address.country')}
            </div>
          </div>
        </section>
      )}

      {showBankForm && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Wallet className="h-4 w-4 text-deliivo-orange" />
            {editingBank && requirements.externalAccount ? t('payout.replaceBankAccount') : t('payout.bankTitle')}
          </h2>
          <p className="mt-1 text-sm text-deliivo-gray">
            {editingBank && requirements.externalAccount ? t('payout.replaceBankCopy') : t('payout.bankCopy')}
          </p>

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
                placeholder={payoutCountryMeta.ibanExample}
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

      {!showBankForm && requirements.externalAccount && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">{t('payout.bankTitle')}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-900">
            <Landmark className="h-4 w-4 text-deliivo-gray" />
            {requirements.externalAccount.bankName || t('payout.bankAccount')} ••••{' '}
            {requirements.externalAccount.last4}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditingBank(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-deliivo-orange hover:bg-orange-50"
            >
              <Wallet className="h-4 w-4" />
              {t('payout.replaceBankAccount')}
            </button>
            <button
              type="button"
              onClick={handleDeleteBankAccount}
              disabled={deletingBank}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deletingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('payout.removeBankAccount')}
            </button>
          </div>
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
              accept={STRIPE_IDENTITY_DOCUMENT_ACCEPT}
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
          onClick={() => loadRequirements()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-deliivo-orange hover:bg-orange-50"
        >
          {t('payout.refreshStatus')}
        </button>
      )}
    </form>
  );
}
