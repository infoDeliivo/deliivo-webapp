'use client';

import { useEffect, useState } from 'react';
import { FileWarning, Loader2, RotateCcw, X } from 'lucide-react';
import { getApiErrorMessage, vehicleApi, type VehicleDocument } from '@/lib/api';

const DOC_TYPE_LABEL: Record<string, string> = {
  VEHICLE_IMAGE: 'Car photo (legacy)',
  VEHICLE_IMAGE_FRONT: 'Car photo — front',
  VEHICLE_IMAGE_BACK: 'Car photo — rear',
  VEHICLE_DOCUMENT: 'Registry document',
  DRIVING_LICENSE: 'Driving licence',
  INSURANCE_DOCUMENT: 'Insurance document',
};

type PreviewState = { url?: string; error?: string; loading: boolean };

/**
 * Signed URLs are fetched only once this panel is open, and are re-fetched on every
 * re-open rather than cached: each admin read of a private KYC document is audit-logged
 * server-side, so pre-loading previews nobody looks at would bury the real accesses in
 * noise. The signatures also expire in ~5 minutes, so a cached URL would break anyway.
 */
export default function VehicleDocuments({ documents }: { documents: VehicleDocument[] }) {
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const privateDocs = documents.filter((doc) => !doc.image && doc.previewKey);

  async function sign(previewKey: string) {
    setPreviews((current) => ({ ...current, [previewKey]: { loading: true } }));
    try {
      const res = await vehicleApi.getDocumentReadUrl(previewKey);
      setPreviews((current) => ({ ...current, [previewKey]: { loading: false, url: res.data.url } }));
    } catch (err: unknown) {
      setPreviews((current) => ({
        ...current,
        [previewKey]: { loading: false, error: getApiErrorMessage(err, 'Preview unavailable') },
      }));
    }
  }

  useEffect(() => {
    // One failed key must not blank the panel, so each is signed independently.
    privateDocs.forEach((doc) => {
      if (doc.previewKey) void sign(doc.previewKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (documents.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        No documents were uploaded with this vehicle.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {documents.map((doc) => {
          const label = DOC_TYPE_LABEL[doc.documentType] || doc.documentType.replace(/_/g, ' ');
          const preview = doc.previewKey ? previews[doc.previewKey] : undefined;
          const url = doc.image || preview?.url;

          return (
            <figure key={doc.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex h-28 items-center justify-center bg-white">
                {url ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url, label })}
                    className="h-full w-full"
                    title="Open full size"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={label} className="h-28 w-full object-cover" />
                  </button>
                ) : preview?.loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                ) : (
                  <button
                    type="button"
                    onClick={() => doc.previewKey && sign(doc.previewKey)}
                    className="flex flex-col items-center gap-1 px-2 text-center text-[11px] text-gray-500 hover:text-[#F97316]"
                  >
                    <FileWarning className="h-4 w-4" />
                    <span>{preview?.error || 'Preview unavailable'}</span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <RotateCcw className="h-3 w-3" /> Retry
                    </span>
                  </button>
                )}
              </div>
              <figcaption className="border-t border-gray-100 px-2 py-1.5 text-[11px] font-medium text-gray-600">
                {label}
                {!doc.image && <span className="ml-1 text-gray-400">· private</span>}
              </figcaption>
            </figure>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-full max-w-4xl overflow-auto rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-gray-900">{lightbox.label}</p>
              <button type="button" onClick={() => setLightbox(null)} className="text-gray-400 hover:text-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.label} className="max-h-[75vh] w-auto" />
          </div>
        </div>
      )}
    </>
  );
}
