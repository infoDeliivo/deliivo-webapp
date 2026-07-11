'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Car, Plus, Trash2, ArrowLeft, Upload, CheckCircle, Camera, Eye, Loader2 } from 'lucide-react';
import { vehicleApi, Vehicle, VehicleType, VehicleDocument, validateImageFile } from '@/lib/api';
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

// KYC documents stored privately (no public URL) — viewed via a short-lived
// signed URL fetched on demand from previewKey.
const PRIVATE_DOC_TYPES = new Set(['DRIVING_LICENSE', 'INSURANCE_DOCUMENT']);
const isPrivateDocType = (documentType: string) => PRIVATE_DOC_TYPES.has(documentType);

const DOC_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(VEHICLE_DOCUMENT_OPTIONS.map((o) => [o.key, o.label]));

// Renders a private KYC document. The signed view URL (300 s TTL) is fetched on
// demand when the user clicks View and is never cached.
function PrivateDocImage({ doc }: { doc: VehicleDocument }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const view = async () => {
    if (!doc.previewKey || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await vehicleApi.getDocumentReadUrl(doc.previewKey);
      setUrl(res.data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load document');
    } finally {
      setLoading(false);
    }
  };

  const label = DOC_TYPE_LABEL[doc.documentType] || doc.documentType;

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-deliivo-dark">{label}</span>
        {!url && (
          <button
            type="button"
            onClick={view}
            disabled={loading || !doc.previewKey}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-deliivo-orange hover:bg-deliivo-orange-light disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            {loading ? 'Loading' : 'View'}
          </button>
        )}
      </div>
      {url && <img src={url} alt={label} className="mt-2 max-h-48 w-full rounded-lg object-contain" />}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function formatVehicleLabel(vehicle: Vehicle) {
  return [vehicle.brand, vehicle.model_name || vehicle.model_num].filter(Boolean).join(' ') || 'Vehicle';
}

function VehicleContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const [returnTo, setReturnTo] = useState('/profile');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Existing-vehicle uploads (presigned flow)
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null); // `${vehicleId}:${type}`
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string[]>>({}); // vehicleId -> documentTypes

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedReturn = params.get('returnTo');
    if (requestedReturn?.startsWith('/') && !requestedReturn.startsWith('//') && !requestedReturn.startsWith('/auth/')) {
      setReturnTo(requestedReturn);
    }
    if (params.get('add') === '1') setShowAddForm(true);
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await vehicleApi.list();
      const savedVehicles = res.data?.vehicles || [];
      setVehicles(savedVehicles);
      if (savedVehicles.length === 0) setShowAddForm(true);
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

  // Document upload state. Public docs (VEHICLE_IMAGE) carry an imageUrl; private
  // KYC docs are attached by key and have no public URL.
  const [documents, setDocuments] = useState<{ documentType: string; imageUrl?: string }[]>([]);
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
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploading(true);
    setError('');
    try {
      if (isPrivateDocType(documentType)) {
        // KYC (licence/insurance): private target, attached by key. No public URL,
        // so track completion by the known documentType.
        await vehicleApi.uploadDraftPrivateDocument(file, documentType);
        setDocuments(prev => [...prev, { documentType }]);
      } else {
        // Public car photo: keeps its confirmed URL for preview.
        const res = await vehicleApi.uploadDraftDocument(file, documentType);
        setDocuments(prev => [...prev, { documentType: res.data.documentType, imageUrl: res.data.imageUrl }]);
      }
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
      if (returnTo !== '/profile') router.push(returnTo);
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

  const handleVehicleImageUpload = async (id: string, file: File) => {
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploadingImageFor(id);
    setError('');
    try {
      const res = await vehicleApi.uploadImage(id, file);
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, imageUrl: res.data.imageUrl } : v)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.vehicleUploadFailed'));
    } finally {
      setUploadingImageFor(null);
    }
  };

  const handleVehicleDocUpload = async (id: string, file: File, documentType: string) => {
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploadingDoc(`${id}:${documentType}`);
    setError('');
    try {
      await vehicleApi.uploadDocument(id, file, documentType);
      setUploadedDocs((prev) => ({ ...prev, [id]: [...(prev[id] || []), documentType] }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.vehicleUploadFailed'));
    } finally {
      setUploadingDoc(null);
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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <Link href={returnTo} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-deliivo-dark">{t('profile.yourVehicles')}</h1>
          <p className="mt-1 text-sm text-deliivo-gray">Add and review the vehicle riders will see on your trips.</p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/60 px-6 py-6 shadow-sm">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-deliivo-orange">Vehicle setup</p>
              <h2 className="mt-1 text-xl font-bold text-deliivo-dark">Keep your ride details clear</h2>
            <p className="mt-2 max-w-2xl text-sm text-deliivo-gray">
                Add the plate and vehicle details first. Photos and supporting documents are optional.
              </p>
            </div>
          </section>

          {hasVehicles ? (
            <div className="space-y-4">
              {vehicles.map((v) => (
            <div key={v.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-gray-100 overflow-hidden group">
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <Car size={24} className="text-deliivo-gray" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingImageFor === v.id ? (
                    <span className="text-[10px] font-semibold text-white">...</span>
                  ) : (
                    <Camera size={18} className="text-white" />
                  )}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImageFor === v.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleVehicleImageUpload(v.id, f);
                    e.target.value = '';
                  }}
                />
                </label>
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

              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-deliivo-gray">Documents</p>
         
                {(() => {
                  const privateDocs = (v.documents || []).filter(
                    (d) => isPrivateDocType(d.documentType) && d.previewKey,
                  );
                  if (privateDocs.length === 0) return null;
                  return (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {privateDocs.map((d) => (
                        <PrivateDocImage key={d.id} doc={d} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
              ))}
            </div>
          ) : (
            <section className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-deliivo-orange-light text-deliivo-orange">
                <Car size={24} />
              </div>
              <h2 className="mt-4 text-lg font-bold text-deliivo-dark">No vehicle added yet</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-deliivo-gray">
                Add one vehicle now so your publish flow is ready and riders can see clearer car details before booking.
              </p>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-24">
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
      ) : (
        <section className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-deliivo-orange-light text-deliivo-orange">
            <Plus size={22} />
          </div>
          <h2 className="mt-5 text-xl font-bold text-deliivo-dark">Add another vehicle</h2>
          <p className="mt-2 text-sm leading-6 text-deliivo-gray">
            Keep multiple vehicles in your profile and use the appropriate one when offering a ride.
          </p>
          <button onClick={() => setShowAddForm(true)} className="btn-primary mt-6 w-full gap-2 py-3 text-sm">
            <Plus size={18} />
            {hasVehicles ? 'Add another vehicle' : 'Add vehicle'}
          </button>
        </section>
        )}
        </div>
      </div>
    </main>
  );
}
