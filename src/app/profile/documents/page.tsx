'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, FileWarning, Files, Loader2, Upload } from 'lucide-react';
import { vehicleApi, Vehicle, VehicleDraft } from '@/lib/api';
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

  useEffect(() => {
    Promise.all([vehicleApi.getDraft(), vehicleApi.list()])
      .then(([draftResult, vehicleResult]) => {
        setDraft(draftResult.data);
        setVehicles(vehicleResult.data?.vehicles || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-deliivo-orange" />
      </div>
    );
  }

  const requiresFullSet = draft?.licenseCountry?.trim().toUpperCase() === 'EE';
  const uploadedTypes = new Set(draft?.documents.map((document) => document.documentType) || []);
  const savedTypes = new Set<string>();
  for (const vehicle of vehicles) {
    if (vehicle.imageUrl) savedTypes.add('VEHICLE_IMAGE_FRONT');
    for (const document of vehicle.documents || []) savedTypes.add(document.documentType);
  }

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
        <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-deliivo-dark">Saved vehicle documents</h2>
          <p className="mt-1 text-sm text-deliivo-gray">
            {savedTypes.size ? `${savedTypes.size} document type${savedTypes.size === 1 ? '' : 's'} saved for your vehicle.` : 'No saved vehicle documents yet.'}
          </p>
          <Link href="/profile/vehicle" className="mt-4 inline-flex text-sm font-semibold text-deliivo-orange hover:underline">View vehicle details</Link>
        </section>
      )}
    </main>
  );
}
