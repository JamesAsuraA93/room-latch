'use client'
import Link from 'next/link'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Dialog,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog'
import {t} from '@/lib/copy'
const USED=1,TOTAL=3
export default function Quota(){return <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col justify-center gap-6 text-center"><h1 className="text-2xl font-bold">{t.quota}</h1><Card className="space-y-4 py-12"><p className="text-zinc-500">{t.usedToday}</p><p className="text-5xl font-bold text-brand">{USED} / {TOTAL}</p><p className="text-zinc-500">{t.remaining} {TOTAL-USED} {t.times}</p><p className="text-xs text-zinc-400">{t.demo}</p></Card><p className="text-sm text-zinc-500">{t.quotaHint}</p><Dialog><DialogTrigger asChild><Button className="w-full">{t.google}</Button></DialogTrigger><DialogContent><DialogTitle className="text-lg font-bold">{t.google}</DialogTitle><DialogDescription className="mt-3 text-sm text-zinc-600">{t.googleDemo}</DialogDescription></DialogContent></Dialog><Button asChild variant="outline" className="w-full"><Link href="/">{t.home}</Link></Button></div>}
