'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Open/close state for a menu anchored to a trigger. The menu is portalled to <body>, so
 * an outside press must check both the trigger and the menu. A blur handler is not enough:
 * Safari does not focus buttons on click, so the menu would close before its item fired.
 */
export function useFloatingMenu() {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (anchorRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, close, toggle, anchorRef, menuRef }
}

/**
 * Renders a menu below its anchor with fixed positioning in a portal, so table wrappers with
 * `overflow` cannot clip it. Scrolling or resizing closes it rather than leaving it adrift.
 */
export function FloatingMenu({
  open,
  onClose,
  anchorRef,
  menuRef,
  align = 'left',
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLDivElement | null>
  menuRef: React.RefObject<HTMLDivElement | null>
  align?: 'left' | 'right'
  className?: string
  children: ReactNode
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle(null)
      return
    }
    const rect = anchorRef.current.getBoundingClientRect()
    setStyle(
      align === 'right'
        ? { position: 'fixed', top: rect.bottom + 4, right: window.innerWidth - rect.right }
        : { position: 'fixed', top: rect.bottom + 4, left: rect.left },
    )
  }, [open, align, anchorRef])

  useEffect(() => {
    if (!open) return
    // Capture phase catches scrolling of any ancestor, including the table's own scroller.
    const onMove = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, onClose, menuRef])

  if (!open || !style) return null
  return createPortal(
    <div ref={menuRef} style={style} className={`z-50 bg-white border border-gray-200 rounded-xl shadow-lg ${className ?? ''}`}>
      {children}
    </div>,
    document.body,
  )
}
