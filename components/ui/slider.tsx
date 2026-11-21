'use client'
import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import {cn} from '@/lib/utils'

// aria-label ต้องอยู่ที่ Thumb ซึ่งเป็น element ที่มี role="slider" ไม่ใช่ Root
export function Slider({className, 'aria-label': ariaLabel, ...props}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-8 w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200">
        <SliderPrimitive.Range className="absolute h-full bg-brand" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={ariaLabel} className="block size-6 rounded-full border-4 border-white bg-brand shadow focus-visible:outline-2 focus-visible:outline-brand" />
    </SliderPrimitive.Root>
  )
}
