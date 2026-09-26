'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RideRequestLayout from '@/components/RideRequestLayout';
import RideRequestBoard from '@/components/RideRequestBoard';
function Board() {
  const params = useSearchParams();
  return <RideRequestBoard initialView={params.get('view') || 'browse'} />;
}
export default function Page() {
  return (
    <RideRequestLayout>
      <Suspense fallback={<p>Loading...</p>}>
        <Board />
      </Suspense>
    </RideRequestLayout>
  );
}
