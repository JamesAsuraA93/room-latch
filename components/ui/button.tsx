import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
const variants = cva('inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', { variants: { variant: { default: 'bg-brand text-white shadow-[0_5px_14px_rgba(128,97,73,0.15)] hover:bg-brand-dark', outline: 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50', ghost: 'text-zinc-800 hover:bg-zinc-100' } }, defaultVariants: { variant: 'default' } })
export function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) { const Comp = asChild ? Slot : 'button'; return <Comp className={cn(variants({variant}),className)} {...props} /> }
