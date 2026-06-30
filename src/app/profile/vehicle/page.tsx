'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, Plus, Trash2, ArrowLeft, Upload, CheckCircle } from 'lucide-react';
import { vehicleApi, Vehicle, VehicleType } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { useTranslation } from '@/lib/i18n-context';

export default function VehiclePage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <VehicleContent />
    </ProtectedRoute>
  );
}

const VEHICLE_DOCUMENT_OPTIONS = [
  { key: 'VEHICLE_IMAGE', label: 'Vehicle photo' },
  { key: 'DRIVING_LICENSE', label: 'Driving license' },
  { key: 'INSURANCE_DOCUMENT', label: 'Insurance document' },
] as const;

function formatVehicleLabel(vehicle: Vehicle) {
  return [vehicle.brand, vehicle.model_name || vehicle.model_num].filter(Boolean).join(' ') || 'Vehicle';
}

function VehicleContent() {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Draft form state
  const [step, setStep] = useState(1);
  const [licenseCountry, setLicenseCountry] = useState('EE');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [modelNum, setModelNum] = useState('');
  const [modelName, setModelName] = useState('');
  const [type, setType] = useState<VehicleType>('sedan');
  const [color, setColor] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await vehicleApi.list();
      setVehicles(res.data?.vehicles || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await vehicleApi.createDraft(licenseCountry, licenseNumber);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.vehicleDraftFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Document upload state
  const [documents, setDocuments] = useState<{ imageUrl: string; documentType: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const vehicleTypes: { value: VehicleType; label: string }[] = [
    { value: 'sedan', label: t('profile.vehicleTypeSedan') },
    { value: 'hatchback', label: t('profile.vehicleTypeHatchback') },
    { value: 'suv', label: t('profile.vehicleTypeSuv') },
    { value: 'minibus', label: t('profile.vehicleTypeMinibus') },
    { value: 'coupe', label: t('profile.vehicleTypeCoupe') },
    { value: 'convertible', label: t('profile.vehicleTypeConvertible') },
    { value: 'pickup', label: t('profile.vehicleTypePickup') },
    { value: 'van', label: t('profile.vehicleTypeVan') },
    { value: 'truck', label: t('profile.vehicleTypeTruck') },
  ];

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await vehicleApi.updateDraftDetails({ brand, model_num: modelNum, model_name: modelName, type, color, year });
      setStep(3); // Go to document upload step
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.vehicleDetailsFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async (file: File, documentType: string) => {
    setUploading(true);
    setError('');
    try {
      const res = await vehicleApi.uploadDraftDocument(file, documentType);
      setDocuments(prev => [...prev, { imageUrl: res.data.imageUrl, documentType: res.data.documentType }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.vehicleUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleFinalizeDraft = async () => {
    setSaving(true);
    setError('');
    try {
      await vehicleApi.saveDraft();
      await fetchVehicles();
      setShowAddForm(false);
      setStep(1);
      resetForm();
      setDocuments([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.vehicleSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('profile.deleteVehicleConfirm'))) return;
    setDeleting(id);
    try {
      await vehicleApi.delete(id);
      setVehicles((v) => v.filter((veh) => veh.id !== id));
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setLicenseCountry('EE');
    setLicenseNumber('');
    setBrand('');
    setModelNum('');
    setModelName('');
    setType('sedan');
    setColor('');
    setYear(new Date().getFullYear());
    setError('');
  };

  const selectedVehicleCount = vehicles.length;
  const hasVehicles = selectedVehicleCount > 0;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start gap-3">
        <Link href="/profile" className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-deliivo-dark">{t('profile.yourVehicles')}</h1>
          <p className="mt-1 text-sm text-deliivo-gray">Add and review the vehicle riders will see on your trips.</p>
        </div>
      </div>

      <section className="mb-6 rounded-3xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/60 px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-deliivo-orange">Vehicle setup</p>
            <h2 className="mt-1 text-xl font-bold text-deliivo-dark">Keep your ride details clear</h2>
            <p className="mt-2 max-w-2xl text-sm text-deliivo-gray">
              Add the plate and vehicle details first. Photos and supporting documents are optional.
            </p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary gap-2 px-5 py-3 text-sm">
            <Plus size={18} />
            {hasVehicles ? 'Add another vehicle' : 'Add vehicle'}
          </button>
        </div>

      </section>

      {hasVehicles ? (
        <div className="mb-6 space-y-4">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <Car size={24} className="text-deliivo-gray" />
                )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-deliivo-dark">{formatVehicleLabel(v)}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.isVerified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {v.isVerified ? t('profile.verifiedVehicle') : t('profile.vehicleNotVerifiedYet')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-deliivo-gray">
                    {[v.color, v.type, v.year].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-deliivo-gray">
                    {v.licenseCountry && <span className="rounded-full bg-gray-100 px-3 py-1">Plate country: {v.licenseCountry}</span>}
                    {v.licenseNumber && <span className="rounded-full bg-gray-100 px-3 py-1">Plate number: {v.licenseNumber}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(v.id)}
                  disabled={deleting === v.id}
                  className="rounded-full p-2 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <section className="mb-6 rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-deliivo-orange-light text-deliivo-orange">
            <Car size={24} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-deliivo-dark">No vehicle added yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-deliivo-gray">
            Add one vehicle now so your publish flow is ready and riders can see clearer car details before booking.
          </p>
        </section>
      )}

      {showAddForm ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-deliivo-dark">{t('profile.addVehicle')}</h2>
              <p className="mt-1 text-sm text-deliivo-gray">Complete the steps below in order. You can skip document uploads and save the vehicle immediately.</p>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((stepNumber) => (
                <div
                  key={stepNumber}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${step === stepNumber ? 'bg-deliivo-orange text-white' : step > stepNumber ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-deliivo-gray'}`}
                >
                  {stepNumber === 1 ? 'Plate' : stepNumber === 2 ? 'Details' : 'Documents'}
                </div>
              ))}
            </div>
          </div>

          {step === 1 && (
            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.country')}</label>
                  <input type="text" value={licenseCountry} onChange={(e) => setLicenseCountry(e.target.value.toUpperCase())} placeholder={t('profile.countryPlaceholder')} className="input-field" maxLength={2} required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.licenseNumber')}</label>
                  <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())} placeholder={t('profile.licenseNumberPlaceholder')} className="input-field" required />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }} className="btn-outline flex-1 py-2 text-sm">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">{saving ? t('profile.creating') : t('profile.next')}</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.brand')}</label>
                  <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota" className="input-field" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.modelNumber')}</label>
                  <input type="text" value={modelNum} onChange={(e) => setModelNum(e.target.value)} placeholder="Avanza" className="input-field" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.modelName')}</label>
                  <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Avanza G" className="input-field" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.type')}</label>
                  <select value={type} onChange={(e) => setType(e.target.value as VehicleType)} className="input-field" required>
                    {vehicleTypes.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.color')}</label>
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Black" className="input-field" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('profile.year')}</label>
                  <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={1990} max={new Date().getFullYear()} className="input-field" required />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1 py-2 text-sm">{t('common.back')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">{saving ? t('profile.saving') : t('profile.next')}</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-deliivo-gray">Upload documents if available. This is optional, and you can still save the vehicle without them.</p>

              {VEHICLE_DOCUMENT_OPTIONS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className={`flex-1 flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm hover:border-deliivo-orange transition-colors ${documents.some(d => d.documentType === key) ? 'border-green-400 bg-green-50' : ''}`}>
                    {documents.some(d => d.documentType === key) ? (
                      <CheckCircle size={16} className="text-green-500 shrink-0" />
                    ) : (
                      <Upload size={16} className="text-deliivo-gray shrink-0" />
                    )}
                    <span>{label}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleDocUpload(f, key);
                      }}
                    />
                  </label>
                </div>
              ))}

              {uploading && <p className="text-xs text-deliivo-gray">Uploading...</p>}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-outline flex-1 py-2 text-sm">Back</button>
                <button type="button" onClick={handleFinalizeDraft} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Vehicle'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}
