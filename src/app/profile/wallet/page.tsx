'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Wallet } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadFailureCard from '@/components/LoadFailureCard';
import { getApiErrorMessage, rewardsApi, type RewardWallet } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';
import { showError } from '@/lib/app-feedback';

function parseCampaignMetadata(metadata: Record<string, unknown> | null | undefined) {
  return {
    headline: typeof metadata?.headline === 'string' ? metadata.headline : '',
    summary: typeof metadata?.summary === 'string' ? metadata.summary : '',
    ctaLabel: typeof metadata?.ctaLabel === 'string' ? metadata.ctaLabel : '',
    placement: typeof metadata?.placement === 'string' ? metadata.placement : '',
    audienceSegment: typeof metadata?.audienceSegment === 'string' ? metadata.audienceSegment : '',
    channel: typeof metadata?.channel === 'string' ? metadata.channel : '',
  };
}

function campaignActionText(triggerType: string, thresholdCount: number, audience: 'RIDER' | 'DRIVER') {
  const threshold = Math.max(1, thresholdCount || 1);
  switch (triggerType) {
    case 'RIDER_REFERRAL_BOOKING_COMPLETION':
      return `Share your rider referral code. The reward lands after the referred rider completes their first booking.`;
    case 'DRIVER_REFERRAL_RIDE_COMPLETION':
      return `Share your driver referral code. The reward lands after the referred driver completes their first ride.`;
    case 'RIDER_COMPLETION_MILESTONE':
      return `Complete ${threshold} bookings and the rider wallet is credited automatically.`;
    case 'DRIVER_COMPLETION_MILESTONE':
      return `Complete ${threshold} rides and the driver wallet is credited automatically.`;
    default:
      return `${audience === 'DRIVER' ? 'Driver' : 'Rider'} wallet reward is applied automatically when the configured trigger is met.`;
  }
}

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <WalletContent />
    </ProtectedRoute>
  );
}

function WalletContent() {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    setLoading(true);
    setError('');
    try {
      const res = await rewardsApi.getMyWallet();
      setWallet(res.data);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, t('profile.earningsLoadFailed'));
      setError(message);
      showError(t('profile.earningsLoadError'), message);
    } finally {
      setLoading(false);
    }
  }

  const walletBalance = useMemo(
    () => wallet?.totals.reduce((sum, total) => sum + total.balance, 0) ?? 0,
    [wallet],
  );
  const walletCurrency = wallet?.totals[0]?.currency || 'EUR';
  const walletCampaignCount = wallet?.campaigns?.length ?? 0;

  if (loading) {
    return <div className="min-h-screen bg-deliivo-cream flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-deliivo-orange" /></div>;
  }

  return (
    <div className="min-h-screen bg-deliivo-cream">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center gap-3 sm:px-6">
        <Link href="/profile" className="flex items-center gap-1 text-sm text-gray-600 hover:text-deliivo-orange transition-colors">
          <ChevronLeft className="w-4 h-4" /> {t('profile.title')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 ml-2">Wallet</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
        {error && (
          <LoadFailureCard
            title="Wallet"
            message={error}
            onRetry={loadWallet}
          />
        )}

        <section id="wallet" className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase text-deliivo-gray">Reward wallet</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{walletCurrency} {walletBalance.toFixed(2)}</p>
              <p className="mt-1 text-xs text-deliivo-gray">
                Referral code: <span className="font-semibold text-gray-900">{wallet?.referralCode || '--'}</span>
              </p>
            </div>
            <div className="text-right text-xs text-deliivo-gray">
              <p>Rider and driver rewards are shown here.</p>
              <p className="mt-1">{wallet?.totals.length ? `${wallet.totals.length} wallet bucket(s)` : 'No rewards yet'}</p>
            </div>
          </div>

          {wallet?.totals?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {wallet.totals.map((total) => (
                <div key={`${total.walletType}-${total.currency}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-deliivo-gray">{total.walletType}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{total.currency} {total.balance.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-deliivo-gray">Credited {total.currency} {total.credited.toFixed(2)} · Spent {total.currency} {total.debited.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : null}

          {wallet?.history?.length ? (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              {wallet.history.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{entry.description || entry.entryType.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="mt-1 text-xs text-deliivo-gray">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold ${entry.direction === 'CREDIT' ? 'text-green-700' : 'text-red-600'}`}>{entry.direction === 'CREDIT' ? '+' : '-'}{entry.currency} {entry.amount.toFixed(2)}</p>
                    <p className="text-xs text-deliivo-gray">{entry.walletType}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {wallet?.campaigns?.length ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-deliivo-gray">Active campaigns</p>
                  <p className="mt-1 text-sm text-deliivo-gray">These offers apply automatically when you complete the configured action.</p>
                </div>
                <p className="text-xs text-deliivo-gray">{walletCampaignCount} live</p>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {wallet.campaigns.map((campaign) => {
                  const metadata = parseCampaignMetadata(campaign.metadataJson);
                  return (
                    <div key={campaign.id} className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{campaign.name}</p>
                          <p className="mt-1 text-xs text-deliivo-gray">{campaign.code} - {campaign.audience}</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-deliivo-orange ring-1 ring-orange-100">
                          {campaign.currency} {campaign.rewardAmount.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-gray-900">
                        {metadata.headline || campaign.description || metadata.summary || 'Active reward campaign'}
                      </p>
                      <p className="mt-2 text-xs text-deliivo-gray">
                        {campaignActionText(campaign.triggerType, campaign.thresholdCount, campaign.audience)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200">
                          Threshold {campaign.thresholdCount}
                        </span>
                        {metadata.placement ? (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200">
                            {metadata.placement}
                          </span>
                        ) : null}
                        {metadata.ctaLabel ? (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200">
                            {metadata.ctaLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
