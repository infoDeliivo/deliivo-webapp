import type { Metadata } from 'next'
import AdminShell from './_components/AdminShell'
import AdminQueryProvider from './_components/AdminQueryProvider'

export const metadata: Metadata = {
  title: 'Admin — Deliivo',
  description: 'Deliivo admin panel',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminQueryProvider>
      <AdminShell>{children}</AdminShell>
    </AdminQueryProvider>
  )
}
