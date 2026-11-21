import * as React from 'react'
import {cn} from '@/lib/utils'
export function Card({className,...props}:React.ComponentProps<'div'>){return <div className={cn('rounded-[26px] border border-[#ebe6df] bg-white p-5 shadow-[0_3px_16px_rgba(83,63,44,0.025)]',className)} {...props}/>}
