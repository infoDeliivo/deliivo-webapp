'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Save, Plus } from 'lucide-react';
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
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-deliivo-dark">Reward campaigns</h1>
          <p className="text-sm text-deliivo-gray">Configure rider and driver referral rewards and milestone credits.</p>
        </div>
        <button onClick={loadCampaigns} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:text-deliivo-orange">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deliivo-gray">Campaign list</h2>
            <span className="text-xs text-deliivo-gray">{campaigns.length} campaigns</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-deliivo-orange" /></div>
          ) : campaigns.length === 0 ? (
            <p className="py-8 text-sm text-deliivo-gray">No campaigns configured yet.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => selectCampaign(campaign)}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left hover:border-deliivo-orange hover:bg-orange-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{campaign.name}</p>
                      <p className="mt-1 text-xs text-deliivo-gray">{campaign.code} · {campaign.triggerType}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${campaign.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {campaign.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-deliivo-gray">
                    {campaign.audience} wallet · {campaign.currency} {campaign.rewardAmount.toFixed(2)} · threshold {campaign.thresholdCount}{campaign.repeatable ? ' repeating' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deliivo-gray">{form.id ? 'Edit campaign' : 'New campaign'}</h2>
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:text-deliivo-orange"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="space-y-3">
            <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Campaign code" />
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="input-field" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as 'RIDER' | 'DRIVER' })}>
                <option value="DRIVER">Driver</option>
                <option value="RIDER">Rider</option>
              </select>
              <select className="input-field" value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })}>
                {triggerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-field" type="number" min="1" value={form.thresholdCount} onChange={(e) => setForm({ ...form, thresholdCount: e.target.value })} placeholder="Threshold" />
              <input className="input-field" type="number" min="0" step="0.01" value={form.rewardAmount} onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })} placeholder="Reward amount" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="Currency" />
              <label className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
                <input type="checkbox" checked={form.repeatable} onChange={(e) => setForm({ ...form, repeatable: e.target.checked })} />
                Repeatable
              </label>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
            <textarea className="input-field min-h-[96px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <textarea className="input-field min-h-[96px]" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Terms" />

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
