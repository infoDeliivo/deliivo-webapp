'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeInfo,
  CalendarDays,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RewardWalletCampaign, getApiErrorMessage, rewardsApi } from '@/lib/api';
import { showError, showSuccess } from '@/lib/app-feedback';

type CampaignForm = {
  id?: string;
  code: string;
  name: string;
  audience: 'RIDER' | 'DRIVER';
  triggerType: string;
  thresholdCount: string;
  rewardAmount: string;
  currency: string;
  active: boolean;
  repeatable: boolean;
  description: string;
  terms: string;
  startsAt: string;
  endsAt: string;
  headline: string;
  summary: string;
  ctaLabel: string;
  placement: string;
  audienceSegment: string;
  channel: string;
  maxPerUser: string;
  stackable: boolean;
  internalNotes: string;
};

type CampaignPreset = {
  title: string;
  description: string;
  form: Partial<CampaignForm>;
};

const emptyForm: CampaignForm = {
  code: 'DRIVER_COMPLETION_MILESTONE',
  name: 'Driver completion milestone',
  audience: 'DRIVER',
  triggerType: 'DRIVER_COMPLETION_MILESTONE',
  thresholdCount: '3',
  rewardAmount: '5',
  currency: 'EUR',
  active: true,
  repeatable: true,
  description: '',
  terms: '',
  startsAt: '',
  endsAt: '',
  headline: 'Complete 3 rides, earn 5 EUR',
  summary: 'Use this for rider or driver incentives that should feel like a visible offer, not just a wallet adjustment.',
  ctaLabel: 'Learn more',
  placement: 'Campaign banner',
  audienceSegment: 'All active users',
  channel: 'Admin configured',
  maxPerUser: '1',
  stackable: false,
  internalNotes: '',
};

const campaignPresets: CampaignPreset[] = [
  {
    title: 'Driver completion bonus',
    description: 'Reward a driver after 3 completed rides.',
    form: {
      code: 'DRIVER_COMPLETION_MILESTONE',
      name: 'Driver completion milestone',
      audience: 'DRIVER',
      triggerType: 'DRIVER_COMPLETION_MILESTONE',
      thresholdCount: '3',
      rewardAmount: '5',
      headline: 'Complete 3 rides, earn 5 EUR',
      summary: 'A simple completion reward that keeps drivers active without changing the core fare.',
      placement: 'Driver dashboard',
      audienceSegment: 'Active drivers',
      channel: 'Wallet bonus',
    },
  },
  {
    title: 'Rider referral bonus',
    description: 'Reward riders after the referred rider completes a booking.',
    form: {
      code: 'RIDER_REFERRAL_BOOKING_COMPLETION',
      name: 'Rider referral reward',
      audience: 'RIDER',
      triggerType: 'RIDER_REFERRAL_BOOKING_COMPLETION',
      thresholdCount: '1',
      rewardAmount: '5',
      headline: 'Invite a rider, earn 5 EUR',
      summary: 'Credit the referrer once the invited rider completes their first booking.',
      placement: 'Referral wallet',
      audienceSegment: 'Existing riders',
      channel: 'Referral incentive',
    },
  },
  {
    title: 'Driver referral bonus',
    description: 'Reward a driver when a referred driver completes their first ride.',
    form: {
      code: 'DRIVER_REFERRAL_RIDE_COMPLETION',
      name: 'Driver referral reward',
      audience: 'DRIVER',
      triggerType: 'DRIVER_REFERRAL_RIDE_COMPLETION',
      thresholdCount: '1',
      rewardAmount: '5',
      headline: 'Refer a driver, earn 5 EUR',
      summary: 'Use this to grow supply with a simple referred-driver reward.',
      placement: 'Driver wallet',
      audienceSegment: 'Existing drivers',
      channel: 'Referral incentive',
    },
  },
  {
    title: 'Rider completion bonus',
    description: 'Reward a rider after 3 completed bookings.',
    form: {
      code: 'RIDER_COMPLETION_MILESTONE',
      name: 'Rider completion milestone',
      audience: 'RIDER',
      triggerType: 'RIDER_COMPLETION_MILESTONE',
      thresholdCount: '3',
      rewardAmount: '5',
      headline: 'Take 3 rides, earn 5 EUR',
      summary: 'Use this for rider retention and repeat bookings.',
      placement: 'Rider dashboard',
      audienceSegment: 'Active riders',
      channel: 'Wallet bonus',
    },
  },
];

const parseCampaignMetadata = (metadata: Record<string, unknown> | null | undefined) => ({
  headline: typeof metadata?.headline === 'string' ? metadata.headline : '',
  summary: typeof metadata?.summary === 'string' ? metadata.summary : '',
  ctaLabel: typeof metadata?.ctaLabel === 'string' ? metadata.ctaLabel : '',
  placement: typeof metadata?.placement === 'string' ? metadata.placement : '',
  audienceSegment: typeof metadata?.audienceSegment === 'string' ? metadata.audienceSegment : '',
  channel: typeof metadata?.channel === 'string' ? metadata.channel : '',
  maxPerUser:
    typeof metadata?.maxPerUser === 'number' || typeof metadata?.maxPerUser === 'string'
      ? String(metadata.maxPerUser)
      : '',
  stackable: Boolean(metadata?.stackable),
  internalNotes: typeof metadata?.internalNotes === 'string' ? metadata.internalNotes : '',
});

const toDateTimeLocal = (value: string | null) => (value ? value.slice(0, 16) : '');

const toIsoOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export default function AdminRewardsPage() {
  return (
    <ProtectedRoute>
      <AdminRewardsContent />
    </ProtectedRoute>
  );
}

function AdminRewardsContent() {
  const [campaigns, setCampaigns] = useState<RewardWalletCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CampaignForm>(emptyForm);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    setError('');
    try {
      const res = await rewardsApi.listCampaigns();
      setCampaigns(res.data);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to load reward campaigns');
      setError(message);
      showError('Campaigns load failed', message);
    } finally {
      setLoading(false);
    }
  }

  function selectCampaign(campaign: RewardWalletCampaign) {
    const metadata = parseCampaignMetadata(campaign.metadataJson);
    setForm({
      id: campaign.id,
      code: campaign.code,
      name: campaign.name,
      audience: campaign.audience,
      triggerType: campaign.triggerType,
      thresholdCount: String(campaign.thresholdCount),
      rewardAmount: String(campaign.rewardAmount),
      currency: campaign.currency,
      active: campaign.active,
      repeatable: campaign.repeatable,
      description: campaign.description || '',
      terms: campaign.terms || '',
      startsAt: toDateTimeLocal(campaign.startsAt),
      endsAt: toDateTimeLocal(campaign.endsAt),
      headline: metadata.headline,
      summary: metadata.summary,
      ctaLabel: metadata.ctaLabel,
      placement: metadata.placement,
      audienceSegment: metadata.audienceSegment,
      channel: metadata.channel,
      maxPerUser: metadata.maxPerUser,
      stackable: metadata.stackable,
      internalNotes: metadata.internalNotes,
    });
  }

  function applyPreset(preset: CampaignPreset) {
    setForm({
      ...emptyForm,
      ...preset.form,
      startsAt: '',
      endsAt: '',
      active: true,
      repeatable: Boolean(preset.form.repeatable ?? emptyForm.repeatable),
      stackable: Boolean(preset.form.stackable ?? emptyForm.stackable),
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const metadata = {
        headline: form.headline.trim() || undefined,
        summary: form.summary.trim() || undefined,
        ctaLabel: form.ctaLabel.trim() || undefined,
        placement: form.placement.trim() || undefined,
        audienceSegment: form.audienceSegment.trim() || undefined,
        channel: form.channel.trim() || undefined,
        maxPerUser: form.maxPerUser.trim() ? Number(form.maxPerUser) : undefined,
        stackable: form.stackable,
        internalNotes: form.internalNotes.trim() || undefined,
      };

      const metadataJson = Object.fromEntries(
        Object.entries(metadata).filter(([, value]) => value !== undefined && value !== ''),
      );

      await rewardsApi.saveCampaign({
        ...(form.id ? { id: form.id } : {}),
        code: form.code,
        name: form.name,
        audience: form.audience,
        triggerType: form.triggerType,
        thresholdCount: Number(form.thresholdCount) || 1,
        rewardAmount: Number(form.rewardAmount) || 0,
        currency: form.currency,
        active: form.active,
        repeatable: form.repeatable,
        description: form.description || null,
        terms: form.terms || null,
        startsAt: toIsoOrNull(form.startsAt),
        endsAt: toIsoOrNull(form.endsAt),
        metadataJson: Object.keys(metadataJson).length > 0 ? metadataJson : null,
      });
      showSuccess('Campaign saved', form.name);
      setForm(emptyForm);
      await loadCampaigns();
    } catch (err: unknown) {
      showError('Campaign save failed', getApiErrorMessage(err, 'Could not save reward campaign'));
    } finally {
      setSaving(false);
    }
  }

  const triggerOptions = useMemo(
    () => [
      'DRIVER_COMPLETION_MILESTONE',
      'RIDER_COMPLETION_MILESTONE',
      'DRIVER_REFERRAL_RIDE_COMPLETION',
      'RIDER_REFERRAL_BOOKING_COMPLETION',
    ],
    [],
  );

  const blueprintSummary = useMemo(
    () => [
      { label: 'Referral', value: 'Reward the referrer after the first successful completion' },
      { label: 'Completion', value: 'Use milestone rewards to keep riders and drivers active' },
      { label: 'Windowing', value: 'Limit campaigns by start and end date when you need a promotion' },
    ],
    [],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-deliivo-orange">
            <Sparkles className="h-3.5 w-3.5" />
            Campaign designer
          </div>
          <h1 className="mt-3 text-2xl font-bold text-deliivo-dark sm:text-3xl">Referral and offer campaigns</h1>
          <p className="mt-2 text-sm text-deliivo-gray">
            Build rider and driver incentives, set their activation window, and attach the campaign copy that the admin team uses to launch an offer.
          </p>
        </div>
        <button onClick={loadCampaigns} className="inline-flex items-center gap-1.5 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:text-deliivo-orange">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-deliivo-gray">
              <WandSparkles className="h-4 w-4 text-deliivo-orange" />
              Blueprints
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-deliivo-gray">
              Start from a rider or driver preset, then tune the trigger, threshold, reward, and offer copy to match your launch plan.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
            <BadgeInfo className="h-3.5 w-3.5 text-deliivo-orange" />
            The backend already stores date windows and metadata.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {campaignPresets.map((preset) => (
            <button
              key={preset.title}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-deliivo-orange hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{preset.title}</p>
                  <p className="mt-1 text-xs leading-5 text-deliivo-gray">{preset.description}</p>
                </div>
                <div className="rounded-xl bg-white p-2 text-deliivo-orange shadow-sm ring-1 ring-orange-100">
                  <Target className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-deliivo-orange">
                <Plus className="h-3.5 w-3.5" />
                Load preset
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {blueprintSummary.map((item) => (
            <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{item.label}</p>
              <p className="mt-2 text-sm text-gray-800">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deliivo-gray">Existing campaigns</h2>
              <p className="mt-1 text-sm text-deliivo-gray">{campaigns.length} campaigns configured</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">Click one to edit</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-deliivo-orange" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="py-8 text-sm text-deliivo-gray">No campaigns configured yet.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const metadata = parseCampaignMetadata(campaign.metadataJson);
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => selectCampaign(campaign)}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-left transition hover:border-deliivo-orange hover:bg-orange-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{campaign.name}</p>
                        <p className="mt-1 text-xs text-deliivo-gray">{campaign.code} · {campaign.triggerType}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${campaign.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {campaign.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-gray-200">{campaign.audience}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-gray-200">{campaign.currency} {campaign.rewardAmount.toFixed(2)}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-gray-200">Threshold {campaign.thresholdCount}</span>
                      {campaign.repeatable && <span className="rounded-full bg-orange-50 px-2.5 py-1 text-deliivo-orange ring-1 ring-orange-100">Repeatable</span>}
                      {campaign.startsAt && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 ring-1 ring-blue-100">Starts {campaign.startsAt.slice(0, 10)}</span>}
                      {campaign.endsAt && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 ring-1 ring-rose-100">Ends {campaign.endsAt.slice(0, 10)}</span>}
                    </div>
                    {(metadata.headline || metadata.summary) && (
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-deliivo-gray">
                        {metadata.headline ? `${metadata.headline} — ` : ''}
                        {metadata.summary}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deliivo-gray">{form.id ? 'Edit campaign' : 'New campaign'}</h2>
              <p className="mt-1 text-sm text-deliivo-gray">Use this panel to design the campaign and the public-facing offer copy.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:text-deliivo-orange"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Campaign code" />
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <select className="input-field" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as 'RIDER' | 'DRIVER' })}>
                <option value="DRIVER">Driver</option>
                <option value="RIDER">Rider</option>
              </select>
              <select className="input-field" value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })}>
                {triggerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-field" type="number" min="1" value={form.thresholdCount} onChange={(e) => setForm({ ...form, thresholdCount: e.target.value })} placeholder="Threshold count" />
              <input className="input-field" type="number" min="0" step="0.01" value={form.rewardAmount} onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })} placeholder="Reward amount" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="Currency" />
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
                <input type="checkbox" checked={form.repeatable} onChange={(e) => setForm({ ...form, repeatable: e.target.checked })} />
                Repeatable
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Start window
                </label>
                <input className="input-field" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                  <CalendarDays className="h-3.5 w-3.5" />
                  End window
                </label>
                <input className="input-field" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Megaphone className="h-4 w-4 text-deliivo-orange" />
                Offer copy
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input-field" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Headline" />
                <input className="input-field" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder="CTA label" />
              </div>
              <textarea className="input-field min-h-[88px]" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Summary" />
              <div className="grid gap-3 sm:grid-cols-3">
                <input className="input-field" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} placeholder="Placement" />
                <input className="input-field" value={form.audienceSegment} onChange={(e) => setForm({ ...form, audienceSegment: e.target.value })} placeholder="Audience segment" />
                <input className="input-field" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} placeholder="Channel" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input-field" type="number" min="1" value={form.maxPerUser} onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })} placeholder="Max per user" />
                <label className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
                  <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
                  Stackable with other offers
                </label>
              </div>
              <textarea className="input-field min-h-[88px]" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} placeholder="Internal notes" />
            </div>

            <textarea className="input-field min-h-[96px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <textarea className="input-field min-h-[96px]" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Terms" />

            <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-orange">Campaign preview</p>
              <p className="mt-2 text-base font-semibold text-deliivo-dark">{form.headline || form.name}</p>
              <p className="mt-1 text-sm text-deliivo-gray">{form.summary || form.description || 'Offer copy will appear here.'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-orange-100">{form.audience}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-orange-100">{form.currency} {Number(form.rewardAmount || 0).toFixed(2)}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-orange-100">{form.placement || 'Placement unset'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-deliivo-orange px-4 py-2 text-sm font-semibold text-white hover:bg-deliivo-orange-dark disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save campaign
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
