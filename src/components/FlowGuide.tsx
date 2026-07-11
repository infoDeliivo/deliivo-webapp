'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Lightbulb, X } from 'lucide-react';

export type FlowGuideStep = {
  title: string;
  copy: string;
};

type FlowGuideProps = {
  storageKey: string;
  eyebrow: string;
  title: string;
  steps: FlowGuideStep[];
  className?: string;
};

export default function FlowGuide({ storageKey, eyebrow, title, steps, className = '' }: FlowGuideProps) {
  const [hidden, setHidden] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(storageKey) === 'hidden');
    setReady(true);
  }, [storageKey]);

  function hideGuide() {
    localStorage.setItem(storageKey, 'hidden');
    setHidden(true);
  }

  function showGuide() {
    localStorage.removeItem(storageKey);
    setHidden(false);
  }

  if (!ready) return null;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={showGuide}
        className={`inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-deliivo-orange shadow-sm hover:bg-orange-50 ${className}`}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Show quick guide
      </button>
    );
  }

  return (
    <section className={`rounded-3xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-deliivo-orange text-white shadow-md shadow-deliivo-orange/20">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-deliivo-orange">{eyebrow}</p>
            <h2 className="mt-1 text-base font-bold text-deliivo-dark">{title}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={hideGuide}
          className="rounded-full p-1.5 text-deliivo-gray hover:bg-white hover:text-deliivo-dark"
          aria-label="Hide quick guide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={`${step.title}-${index}`} className="rounded-2xl border border-orange-100 bg-white/85 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-deliivo-orange" />
              <div>
                <p className="text-sm font-semibold text-deliivo-dark">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-deliivo-gray">{step.copy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
