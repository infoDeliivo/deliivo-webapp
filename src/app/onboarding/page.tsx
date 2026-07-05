'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { userApi } from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useTranslation } from '@/lib/i18n-context';
import { getSafeReturnTo } from '@/lib/auth-redirect';

const MINIMUM_BOOKING_AGE_YEARS = 8;
const PERSON_NAME_PATTERN = /^(?=.*\p{L})[\p{L}\p{M} .'-]+$/u;

function getLatestAllowedDob() {
  const now = new Date();
  return new Date(now.getFullYear() - MINIMUM_BOOKING_AGE_YEARS, now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingForm />
    </ProtectedRoute>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [nickName, setNickName] = useState('');
  const [dob, setDob] = useState('');
  const [salutation, setSalutation] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY' | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const maxDob = getLatestAllowedDob();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!dob) {
      setError(t('onboarding.dobRequired', { age: MINIMUM_BOOKING_AGE_YEARS }));
      return;
    }
    if (!PERSON_NAME_PATTERN.test(name.trim())) {
      setError(t('onboarding.nameInvalid'));
      return;
    }
    if (dob > maxDob) {
      setError(t('onboarding.minimumAge', { age: MINIMUM_BOOKING_AGE_YEARS }));
      return;
    }
    setLoading(true);
    try {
      await userApi.completeOnboarding({
        name,
        nickName: nickName || undefined,
        dob: dob || undefined,
        salutation,
        gender: gender || undefined,
      });
      await refreshUser();
      router.replace(getSafeReturnTo() || '/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('onboarding.failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-deliivo-cream px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="hidden rounded-[2rem] bg-gradient-to-br from-[#fff4ea] via-white to-[#fde7d3] p-8 shadow-sm ring-1 ring-black/5 lg:block">
          <BrandLogo size={44} className="h-auto w-auto" />
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-deliivo-dark sm:text-4xl">{t('onboarding.title')}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-deliivo-gray sm:text-base">{t('onboarding.subtitle')}</p>
          <div className="mt-8 space-y-3 text-sm text-deliivo-gray">
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="font-semibold text-deliivo-dark">{t('onboarding.gender')}</p>
              <p className="mt-1 text-xs sm:text-sm">{t('onboarding.genderCopy')}</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="font-semibold text-deliivo-dark">{t('onboarding.dob')}</p>
              <p className="mt-1 text-xs sm:text-sm">{t('onboarding.dobCopy', { age: MINIMUM_BOOKING_AGE_YEARS })}</p>
            </div>
          </div>
        </section>

        <div className="w-full">
          <div className="mb-6 text-center lg:hidden">
            <BrandLogo size={38} className="mx-auto h-auto w-auto" />
            <h1 className="mt-4 text-2xl font-bold text-deliivo-dark">{t('onboarding.title')}</h1>
            <p className="mt-1 text-sm text-deliivo-gray">{t('onboarding.subtitle')}</p>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="salutation" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                    {t('onboarding.salutation')} *
                  </label>
                  <select
                    id="salutation"
                    value={salutation}
                    onChange={(e) => setSalutation(e.target.value)}
                    required
                    className="input-field"
                  >
                    <option value="">{t('onboarding.select')}</option>
                    <option value="MR">{t('onboarding.mr')}</option>
                    <option value="MS">{t('onboarding.ms')}</option>
                    <option value="MRS">{t('onboarding.mrs')}</option>
                    <option value="MX">{t('onboarding.mx')}</option>
                    <option value="OTHER">{t('onboarding.other')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="gender" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                    {t('onboarding.gender')} *
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as typeof gender)}
                    required
                    className="input-field"
                  >
                    <option value="">{t('onboarding.select')}</option>
                    <option value="FEMALE">{t('onboarding.female')}</option>
                    <option value="MALE">{t('onboarding.male')}</option>
                    <option value="NON_BINARY">{t('onboarding.nonBinary')}</option>
                    <option value="OTHER">{t('onboarding.other')}</option>
                    <option value="PREFER_NOT_TO_SAY">{t('onboarding.preferNotSay')}</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                    {t('onboarding.fullName')} *
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder={t('onboarding.fullNamePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="nickName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                    {t('onboarding.nickname')}
                  </label>
                  <input
                    id="nickName"
                    type="text"
                    placeholder={t('onboarding.nicknamePlaceholder')}
                    value={nickName}
                    onChange={(e) => setNickName(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="dob" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                  {t('onboarding.dob')} *
                </label>
                <input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={maxDob}
                  required
                  className="input-field"
                />
                <p className="mt-1 text-xs text-deliivo-gray">{t('onboarding.dobCopy', { age: MINIMUM_BOOKING_AGE_YEARS })}</p>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <button type="submit" disabled={loading || !name.trim() || !salutation || !gender || !dob} className="btn-primary w-full py-3 text-base disabled:opacity-50">
                {loading ? t('onboarding.saving') : t('onboarding.complete')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
