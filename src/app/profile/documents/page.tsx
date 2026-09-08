'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, FileWarning, Files, Loader2, Upload } from 'lucide-react';
import { getApiErrorMessage, UPLOAD_ACCEPT, validateImageFile, vehicleApi, Vehicle, VehicleDraft } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

const DOCUMENTS = [
  { type: 'VEHICLE_IMAGE_FRONT', label: 'Vehicle photo (front)' },
  { type: 'VEHICLE_IMAGE_BACK', label: 'Vehicle photo (rear)' },
  { type: 'VEHICLE_DOCUMENT', label: 'Vehicle registration document' },
  { type: 'INSURANCE_DOCUMENT', label: 'Insurance document' },
  { type: 'DRIVING_LICENSE', label: 'Driving licence' },
] as const;

const REQUIRED_FOR_EE = new Set([
  'VEHICLE_IMAGE_FRONT',
  'VEHICLE_IMAGE_BACK',
  'VEHICLE_DOCUMENT',
  'INSURANCE_DOCUMENT',
]);

// A driving licence is a user-level verification document, not a vehicle document.
// It is displayed while completing a draft but is not uploaded to a saved vehicle.
const VEHICLE_DOCUMENTS = DOCUMENTS.filter(({ type }) => type !== 'DRIVING_LICENSE');

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <DocumentsContent />
    </ProtectedRoute>
  );
}

function DocumentsContent() {
  const [draft, setDraft] = useState<VehicleDraft | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadDocuments = async () => {
    const [draftResult, vehicleResult] = await Promise.all([vehicleApi.getDraft(), vehicleApi.list()]);
    setDraft(draftResult.data);
    setVehicles(vehicleResult.data?.vehicles || []);
  };

  useEffect(() => {
    loadDocuments()
      .finally(() => setLoading(false));
  }, []);

  const uploadSavedDocument = async (vehicleId: string, documentType: string, file: File) => {
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    const key = `${vehicleId}:${documentType}`;
    setUploading(key);
    setError('');
    try {
      // The front vehicle photo is the rider-visible Vehicle.imageUrl. All supporting
      // documents use the private vehicle_document upload target.
      if (documentType === 'VEHICLE_IMAGE_FRONT') {
        await vehicleApi.uploadImage(vehicleId, file);
      } else {
        await vehicleApi.uploadDocument(vehicleId, file, documentType);
      }
      await loadDocuments();
    } catch (uploadError: unknown) {
      setError(getApiErrorMessage(uploadError, 'Could not upload the document. Please try again.'));
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-deliivo-orange" />
      </div>
    );
  }

  const requiresFullSet = draft?.licenseCountry?.trim().toUpperCase() === 'EE';
  const uploadedTypes = new Set(draft?.documents.map((document) => document.documentType) || []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start gap-3">
        <Link href="/profile" className="rounded-full p-2 hover:bg-gray-100" aria-label="Back to profile">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-deliivo-dark">My documents</h1>
          <p className="mt-1 text-sm text-deliivo-gray">Check uploads and continue any vehicle setup that was interrupted.</p>
        </div>
      </div>

      {draft ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="flex gap-3">
            <FileWarning className="mt-0.5 shrink-0 text-amber-600" size={22} />
            <div>
              <h2 className="font-bold text-deliivo-dark">Vehicle setup needs attention</h2>
              <p className="mt-1 text-sm text-deliivo-gray">Previous uploads are saved. Add or replace pending documents, then finish vehicle setup.</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {DOCUMENTS.map(({ type, label }) => {
              const uploaded = uploadedTypes.has(type);
              const required = requiresFullSet && (REQUIRED_FOR_EE.has(type) || type === 'DRIVING_LICENSE');
              return (
                <div key={type} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
                  {uploaded ? <CheckCircle size={18} className="shrink-0 text-green-600" /> : <Files size={18} className="shrink-0 text-deliivo-gray" />}
                  <span className="text-sm font-medium text-deliivo-dark">{label}</span>
                  <span className={`ml-auto text-xs font-semibold ${uploaded ? 'text-green-700' : required ? 'text-amber-700' : 'text-deliivo-gray'}`}>
                    {uploaded ? 'Uploaded' : required ? 'Required' : 'Optional'}
                  </span>
                </div>
              );
            })}
          </div>
          <Link href="/profile/vehicle?resume=1" className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Upload size={16} /> Add or replace documents
          </Link>
        </section>
      ) : (
        <section className="rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <CheckCircle className="mx-auto text-green-600" size={30} />
          <h2 className="mt-3 font-bold text-deliivo-dark">No unfinished uploads</h2>
          <p className="mt-1 text-sm text-deliivo-gray">There is no active vehicle setup waiting for documents.</p>
          <Link href="/profile/vehicle?add=1" className="btn-outline mt-5 inline-flex px-4 py-2 text-sm">Add a vehicle</Link>
        </section>
      )}

      {vehicles.length > 0 && (
        <section className="mt-6 space-y-4">
          <div>
            <h2 className="font-bold text-deliivo-dark">Saved vehicle documents</h2>
            <p className="mt-1 text-sm text-deliivo-gray">Upload a missing file or replace a document for the specific vehicle.</p>
          </div>
          {vehicles.map((vehicle) => {
            const requiredForVehicle = vehicle.licenseCountry?.trim().toUpperCase() === 'EE';
            const storedDocs = new Map((vehicle.documents || []).map((document) => [document.documentType, document]));
            return (
              <div key={vehicle.id} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-deliivo-dark">
                  {[vehicle.brand, vehicle.model_name || vehicle.model_num].filter(Boolean).join(' ') || 'Vehicle'}
                </h3>
                {vehicle.licenseNumber && <p className="mt-1 text-xs text-deliivo-gray">{vehicle.licenseCountry} {vehicle.licenseNumber}</p>}
                <div className="mt-4 space-y-2">
                  {VEHICLE_DOCUMENTS.map(({ type, label }) => {
                    const document = storedDocs.get(type);
                    const uploaded = type === 'VEHICLE_IMAGE_FRONT' ? Boolean(vehicle.imageUrl) : Boolean(document && !document.storageMissing);
                    const missingFromStorage = Boolean(document?.storageMissing);
                    const required = requiredForVehicle && REQUIRED_FOR_EE.has(type);
                    const uploadKey = `${vehicle.id}:${type}`;
                    const busy = uploading === uploadKey;
                    return (
                      <div key={type} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${missingFromStorage ? 'border-red-200 bg-red-50' : uploaded ? 'border-green-100 bg-green-50/50' : 'border-gray-100'}`}>
                        {uploaded ? <CheckCircle size={18} className="shrink-0 text-green-600" /> : <Files size={18} className="shrink-0 text-deliivo-gray" />}
                        <span className="text-sm font-medium text-deliivo-dark">{label}</span>
                        <span className={`ml-auto text-xs font-semibold ${uploaded ? 'text-green-700' : missingFromStorage ? 'text-red-700' : required ? 'text-amber-700' : 'text-deliivo-gray'}`}>
                          {uploaded ? 'Uploaded' : missingFromStorage ? 'File missing' : required ? 'Required' : 'Not uploaded'}
                        </span>
                        <label className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg border border-deliivo-orange px-2.5 py-1.5 text-xs font-semibold text-deliivo-orange hover:bg-deliivo-orange-light">
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                          {uploaded ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept={UPLOAD_ACCEPT}
                            className="hidden"
                            disabled={busy}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadSavedDocument(vehicle.id, type, file);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </section>
      )}
    </main>
  );
}
