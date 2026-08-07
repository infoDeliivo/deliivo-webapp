'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Car,
  Flag,
  Euro,
  Settings,
  Banknote,
  Newspaper,
  Siren,
  Activity,
  BadgeCheck,
  IdCard,
  X,
} from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Rides', href: '/admin/rides', icon: Car },
  { label: 'Vehicles', href: '/admin/vehicles', icon: BadgeCheck },
  { label: 'Licences', href: '/admin/dl-verification', icon: IdCard },
  { label: 'SOS', href: '/admin/sos', icon: Siren },
  { label: 'Disputes', href: '/admin/reports', icon: Flag },
  { label: 'Payouts', href: '/admin/payouts', icon: Banknote },
  { label: 'Revenue', href: '/admin/revenue', icon: Euro },
  { label: 'Pricing', href: '/admin/pricing', icon: Euro },
  { label: 'Monitoring', href: '/admin/monitoring', icon: Activity },
  { label: 'Content', href: '/admin/content', icon: Newspaper },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

export default function AdminSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const pathname = usePathname()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ background: '#1A1A2E' }}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <BrandLogo size={37} className="h-9 w-auto object-contain" />
        <div className="min-w-0">
          <p className="text-lg font-black tracking-tight text-white">Deliivo</p>
          <span className="text-xs font-medium uppercase tracking-widest text-white/40">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close admin menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#F97316] text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-4">
        <p className="text-xs text-white/30">Deliivo v1.0 - Admin Panel</p>
      </div>
    </aside>
  )
}
