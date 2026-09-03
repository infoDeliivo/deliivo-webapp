'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Car, Plus, Trash2, ArrowLeft, Upload, CheckCircle, Camera, Eye, Loader2 } from 'lucide-react';
import { vehicleApi, dlVerificationApi, Vehicle, VehicleType, VehicleDocument, validateImageFile, UPLOAD_ACCEPT, ApiError, UploadStage } from '@/lib/api';
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
  { key: 'VEHICLE_IMAGE_FRONT', label: 'Vehicle photo (front)' },
  { key: 'VEHICLE_IMAGE_BACK', label: 'Vehicle photo (rear)' },
  { key: 'VEHICLE_DOCUMENT', label: 'Vehicle registration document' },
  { key: 'DRIVING_LICENSE', label: 'Driving license' },
  { key: 'INSURANCE_DOCUMENT', label: 'Insurance document' },
] as const;

// Mirrors the backend: drivers with a plate from these countries must supply the
// full set below before /vehicles/draft/save accepts the vehicle. Keep in sync
// with DOCUMENT_REQUIRED_COUNTRIES / REQUIRED_DOCUMENT_TYPES in vehicle.constants.ts.
const DOCUMENT_REQUIRED_COUNTRIES = new Set(['EE']);
const REQUIRED_DOC_TYPES = ['VEHICLE_IMAGE_FRONT', 'VEHICLE_IMAGE_BACK', 'VEHICLE_DOCUMENT'] as const;
const requiresFullDocumentSet = (licenseCountry: string) =>
  DOCUMENT_REQUIRED_COUNTRIES.has(licenseCountry.trim().toUpperCase());

// The driving licence is checked against the person, not the vehicle: a driver who is
// already verified, or who has a licence awaiting review, is not asked again when they
// add a second vehicle. Mirrors the DL_DOCUMENT_REQUIRED gate in draft-vehicle.service.ts.
const DL_DOC_TYPE = 'DRIVING_LICENSE';

// Documents stored privately (no public URL) — viewed via a short-lived signed
// URL fetched on demand from previewKey. The registry document is private too:
// uploading it to a public target makes the backend drop the URL and the draft
// stays incomplete.
const PRIVATE_DOC_TYPES = new Set(['DRIVING_LICENSE', 'INSURANCE_DOCUMENT', 'VEHICLE_DOCUMENT']);
const isPrivateDocType = (documentType: string) => PRIVATE_DOC_TYPES.has(documentType);

// Re-uploading a type replaces the earlier entry — the draft keeps one document
// per type, so appending would leave a stale duplicate in the checklist.
type DraftDocument = { documentType: string; imageUrl?: string };
const upsertDocument = (docs: DraftDocument[], doc: DraftDocument): DraftDocument[] => [
  ...docs.filter((d) => d.documentType !== doc.documentType),
  doc,
];

// Per-document upload state. One upload is four sequential network calls
// (presign -> PUT to storage -> confirm -> attach to the draft), so it is slow enough
// that the user will reach for the next document while it runs. Tracking each slot
// separately is what keeps a slow or failed upload in one row from disabling, blocking
// or silently discarding a click in another.
type SlotStatus = 'queued' | 'uploading' | 'done' | 'error';
type SlotState = {
  status: SlotStatus;
  error?: string;
  stage?: UploadStage;
  file?: File;
  // Only an upload that actually started and then failed blocks Save. A file rejected
  // by validateImageFile never left the browser, so it is no different from not having
  // picked one — blocking on it would trap the user with no way to clear the error.
  blocksSave?: boolean;
};
const isSlotBusy = (slot?: SlotState) => slot?.status === 'queued' || slot?.status === 'uploading';

const DOC_TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(VEHICLE_DOCUMENT_OPTIONS.map((o) => [o.key, o.label])),
  // Legacy single-photo type on vehicles saved before the front/rear split.
  VEHICLE_IMAGE: 'Vehicle photo',
};

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

  // Licence state, read from the backend rather than inferred from this draft: a
  // licence uploaded for an earlier vehicle already satisfies the gate.
  const [dlOnFile, setDlOnFile] = useState(false);
  const [dlDeclineReason, setDlDeclineReason] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicles();
    void fetchDlStatus();
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

  const fetchDlStatus = async () => {
    try {
      const res = await dlVerificationApi.status();
      // APPROVED covers the Veriff path, which leaves no uploaded image behind.
      setDlOnFile(Boolean(res.data?.hasDocument) || res.data?.status === 'APPROVED');
      setDlDeclineReason(res.data?.status === 'DECLINED' ? (res.data.declineReason ?? null) : null);
    } catch {
      // A failed status read must not block adding a vehicle; the backend still gates.
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

  // Document upload state. Public docs (front/rear photo) carry an imageUrl;
  // private KYC docs are attached by key and have no public URL.
  const [documents, setDocuments] = useState<DraftDocument[]>([]);
  // Keyed by documentType. Replaces a single shared `uploading` boolean, which disabled
  // every file input at once: clicking a label wrapping a disabled input opens no file
  // picker, so the click was swallowed with no feedback at all.
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  // Uploads run one at a time. The backend attaches each document by reading the draft
  // out of Redis, mutating it and writing it back (addDocument in
  // draft-vehicle.service.ts), so two concurrent attaches can lose one. Queueing keeps
  // that serialization without disabling the other inputs.
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
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

  const setSlot = (documentType: string, patch: SlotState) =>
    setSlots((prev) => ({ ...prev, [documentType]: patch }));

  const runDocUpload = async (file: File, documentType: string) => {
    setSlot(documentType, { status: 'uploading', file });
    try {
      if (isPrivateDocType(documentType)) {
        // KYC (licence/insurance/registry): private target, attached by key. No
        // public URL, so track completion by the known documentType.
        const uploaded = await vehicleApi.uploadDraftPrivateDocument(file, documentType);
        setDocuments(prev => upsertDocument(prev, { documentType }));

        // A licence also enters the manual admin review queue. The vehicle draft and
        // the review row point at the same private object. If this call fails the
        // document is uploaded but not queued for review, so the slot stays in error
        // and Save stays blocked.
        if (documentType === DL_DOC_TYPE) {
          await dlVerificationApi.submitDocument(uploaded.key);
          setDlOnFile(true);
          setDlDeclineReason(null);
        }
      } else {
        // Public car photo (front/rear): keeps its confirmed URL for preview.
        const res = await vehicleApi.uploadDraftDocument(file, documentType);
        setDocuments(prev => upsertDocument(prev, { documentType: res.data.documentType, imageUrl: res.data.imageUrl }));
      }
      setSlot(documentType, { status: 'done' });
    } catch (err: unknown) {
      // `stage` says which of the four calls died, which decides where the file ended
      // up: a failure at presign/put/confirm strands it under tmp/ (the bucket
      // lifecycle rule deletes it within a day), while a failure at attach leaves it
      // in permanent storage but unreferenced.
      const stage = err instanceof ApiError ? err.stage : undefined;
      pushEvent('vehicle_document_upload_failed', {
        document_type: documentType,
        stage: stage ?? 'unknown',
        request_id: err instanceof ApiError ? err.requestId : undefined,
        status: err instanceof ApiError ? err.status : undefined,
      });
      // Keep the File so Retry needs no second trip through the picker.
      setSlot(documentType, {
        status: 'error',
        stage,
        error: err instanceof Error ? err.message : t('profile.vehicleUploadFailed'),
        file,
        blocksSave: true,
      });
    }
  };

  const enqueueDocUpload = (file: File, documentType: string) => {
    const invalid = validateImageFile(file);
    if (invalid) {
      setSlot(documentType, { status: 'error', error: invalid, file, blocksSave: false });
      return;
    }
    setSlot(documentType, { status: 'queued', file });
    uploadQueue.current = uploadQueue.current
      .then(() => runDocUpload(file, documentType))
      // runDocUpload already handles its own errors; this only stops one rejection
      // from poisoning the chain for every upload queued behind it.
      .catch(() => {});
  };

  // Slots still working or failed. These gate Save independently of the required-document
  // check below, which is empty for plate countries that do not mandate documents — that
  // is how a vehicle could previously be saved while an upload had silently failed.
  const uploadsInFlight = Object.values(slots).some(isSlotBusy);
  const failedDocTypes = VEHICLE_DOCUMENT_OPTIONS
    .filter(({ key }) => slots[key]?.status === 'error' && slots[key]?.blocksSave)
    .map(({ key }) => key);

  // Give up on a document whose upload keeps failing: clears the slot so Save unblocks.
  // Required documents stay blocked by missingRequiredDocs, which this does not touch.
  const discardSlot = (documentType: string) =>
    setSlots((prev) => {
      const next = { ...prev };
      delete next[documentType];
      return next;
    });

  // An upload that is interrupted mid-flight leaves the file stranded and unrecoverable,
  // so warn rather than let the tab close silently.
  useEffect(() => {
    if (!uploadsInFlight) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    // Backgrounding the tab is what mobile does when the native picker or camera opens,
    // and it is when in-flight requests get torn down. Recording it separates that cause
    // from an ordinary network failure in the analytics.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pushEvent('vehicle_document_upload_backgrounded', {
          in_flight: Object.values(slots).filter(isSlotBusy).length,
        });
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [uploadsInFlight, slots]);

  // Documents the current plate country makes mandatory, and which are still missing.
  const documentsRequired = requiresFullDocumentSet(licenseCountry);
  const missingRequiredDocs = documentsRequired
    ? REQUIRED_DOC_TYPES.filter((type) => !documents.some((d) => d.documentType === type))
    : [];
  // The licence is satisfied by one already on file, so a second vehicle does not ask.
  const dlSatisfied = dlOnFile || documents.some((d) => d.documentType === DL_DOC_TYPE);
  const dlMissing = documentsRequired && !dlSatisfied;

  const handleFinalizeDraft = async () => {
    // Saving mid-upload persists a vehicle whose documents are still in flight, and
    // saving over a failed upload persists one that points at storage holding nothing.
    if (uploadsInFlight) {
      setError('Wait for the documents still uploading to finish before saving.');
      return;
    }
    if (failedDocTypes.length > 0) {
      setError(
        `These uploads failed and must be retried before saving: ${failedDocTypes
          .map((type) => DOC_TYPE_LABEL[type] || type)
          .join(', ')}`,
      );
      return;
    }
    // The backend rejects an incomplete set with VEHICLE_DOCUMENTS_REQUIRED; name
    // the missing documents here instead of surfacing raw enum values.
    if (missingRequiredDocs.length > 0) {
      setError(
        `Upload these documents before saving: ${missingRequiredDocs
          .map((type) => DOC_TYPE_LABEL[type] || type)
          .join(', ')}`,
      );
      return;
    }
    // Matches DL_DOCUMENT_REQUIRED on the backend.
    if (dlMissing) {
      setError('Upload a photo of your driving licence before saving this vehicle.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await vehicleApi.saveDraft();
      await fetchVehicles();
      setShowAddForm(false);
      setStep(1);
      resetForm();
      setDocuments([]);
      setSlots({});
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
                  accept={UPLOAD_ACCEPT}
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
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        v.verificationStatus === 'APPROVED'
                          ? 'bg-green-50 text-green-700'
                          : v.verificationStatus === 'REJECTED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {v.verificationStatus === 'APPROVED'
                        ? t('profile.verifiedVehicle')
                        : v.verificationStatus === 'REJECTED'
                          ? t('profile.vehicleRejected')
                          : t('profile.vehicleNotVerifiedYet')}
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

              {v.verificationStatus === 'REJECTED' && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700">{t('profile.vehicleRejected')}</p>
                  {/* Admin free text: interpolated as a value, never used as a key. */}
                  {v.rejectionReason && (
                    <p className="mt-1 text-xs leading-5 text-red-700">{v.rejectionReason}</p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-red-600">{t('profile.vehicleRejectedHelp')}</p>
                </div>
              )}

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
              <p className="text-sm text-deliivo-gray">
                {documentsRequired
                  ? `Vehicles with a ${licenseCountry.toUpperCase()} plate need the front photo, rear photo, registration document and your driving licence. The rest are optional.`
                  : 'Upload documents if available. This is optional, and you can still save the vehicle without them.'}
              </p>

              {documentsRequired && dlOnFile && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                  Your driving licence is already on file — you do not need to upload it again.
                </p>
              )}

              {dlDeclineReason && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  Your driving licence was declined: {dlDeclineReason} Upload a new photo below.
                </p>
              )}

              {VEHICLE_DOCUMENT_OPTIONS.map(({ key, label }) => {
                const uploaded = documents.some(d => d.documentType === key);
                // The licence is required by the person, not the draft — and already
                // satisfied if one is on file from an earlier vehicle.
                const required = documentsRequired && (
                  key === DL_DOC_TYPE
                    ? !dlOnFile
                    : (REQUIRED_DOC_TYPES as readonly string[]).includes(key)
                );
                const slot = slots[key];
                const busy = isSlotBusy(slot);
                const failed = slot?.status === 'error';
                return (
                <div key={key} className="space-y-1">
                  <label className={`flex w-full items-center gap-2 cursor-pointer rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm hover:border-deliivo-orange transition-colors ${failed ? 'border-red-300 bg-red-50/50' : uploaded ? 'border-green-400 bg-green-50' : required ? 'border-amber-300 bg-amber-50/40' : ''}`}>
                    {busy ? (
                      <Loader2 size={16} className="shrink-0 animate-spin text-deliivo-orange" />
                    ) : uploaded ? (
                      <CheckCircle size={16} className="text-green-500 shrink-0" />
                    ) : (
                      <Upload size={16} className="text-deliivo-gray shrink-0" />
                    )}
                    <span>{label}</span>
                    {slot?.status === 'queued' && <span className="text-xs text-deliivo-gray">Waiting...</span>}
                    {slot?.status === 'uploading' && <span className="text-xs text-deliivo-gray">Uploading...</span>}
                    {required && !uploaded && (
                      <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Required</span>
                    )}
                    <input
                      type="file"
                      accept={UPLOAD_ACCEPT}
                      className="hidden"
                      // Only this slot is disabled, and only while it is actually
                      // working. Every other row stays clickable.
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) enqueueDocUpload(f, key);
                        // Clearing the value is what makes re-picking the same file
                        // fire another change event, so a retry after a failure works.
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {failed && (
                    <div className="flex flex-wrap items-center gap-2 pl-1">
                      <p className="text-xs text-red-600">
                        {slot?.error}
                        {slot?.stage ? ` (failed at: ${slot.stage})` : ''}
                      </p>
                      {slot?.file && (
                        <button
                          type="button"
                          onClick={() => enqueueDocUpload(slot.file!, key)}
                          className="rounded-lg border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Retry
                        </button>
                      )}
                      {slot?.blocksSave && (
                        <button
                          type="button"
                          onClick={() => discardSlot(key)}
                          className="rounded-lg px-2 py-0.5 text-xs font-semibold text-deliivo-gray hover:bg-gray-100"
                        >
                          Discard
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-outline flex-1 py-2 text-sm">Back</button>
                <button
                  type="button"
                  onClick={handleFinalizeDraft}
                  disabled={saving || missingRequiredDocs.length > 0 || uploadsInFlight || failedDocTypes.length > 0}
                  className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
                >
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
