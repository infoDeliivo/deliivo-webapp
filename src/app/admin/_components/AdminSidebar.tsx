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
  Gift,
  ClipboardList,
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
  { label: 'Rewards', href: '/admin/rewards', icon: Gift },
  { label: 'Pricing', href: '/admin/pricing', icon: Euro },
  { label: 'Monitoring', href: '/admin/monitoring', icon: Activity },
  { label: 'Tracker', href: '/admin/tracker', icon: ClipboardList },
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
      className={`fixed inset-y-0 left-0 z-40 shrink-0 overflow-hidden transition-[transform,width] duration-200 lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 ${
        isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex h-full w-64 flex-col" style={{ background: '#1A1A2E' }}>
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="min-w-0">
          <BrandLogo
            size={37}
            className="h-9 w-auto object-contain brightness-0 invert"
          />
          <span className="mt-1 block text-xs font-medium uppercase tracking-widest text-white/40">
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
      </div>
    </aside>
  )
}
