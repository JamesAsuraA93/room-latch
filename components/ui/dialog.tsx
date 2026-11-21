'use client'
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {t} from '@/lib/copy'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

export function DialogContent({children, closeLabel = t.close, ...props}: React.ComponentProps<typeof DialogPrimitive.Content> & {closeLabel?: string}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-lg" {...props}>
        {children}
        {/* มือถือไม่มีปุ่ม Esc ถ้าไม่มีปุ่มนี้จะปิดได้ทางเดียวคือแตะพื้นหลัง */}
        <DialogPrimitive.Close className="mt-5 min-h-12 w-full rounded-2xl border border-zinc-200 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
          {closeLabel}
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
