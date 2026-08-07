'use client'

import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export default function AdminTopBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-[#F97316]"
          aria-label={sidebarOpen ? 'Hide admin menu' : 'Show admin menu'}
        >
          <Menu className="h-4 w-4 lg:hidden" />
          {sidebarOpen ? (
            <PanelLeftClose className="hidden h-4 w-4 lg:block" />
          ) : (
            <PanelLeftOpen className="hidden h-4 w-4 lg:block" />
          )}
        </button>

        <div>
          <p className="text-sm text-gray-400">Welcome back,</p>
          <p className="text-sm font-semibold text-gray-900">Admin User</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative p-2 text-gray-500 transition-colors hover:text-[#F97316]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F97316]" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F97316] text-sm font-bold text-white">
            A
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
