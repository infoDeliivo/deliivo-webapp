import type { Metadata } from 'next'
import AdminShell from './_components/AdminShell'

export const metadata: Metadata = {
  title: 'Admin — Deliivo',
  description: 'Deliivo admin panel',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
