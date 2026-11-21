import type { Metadata, Viewport } from 'next'
import './globals.css'
import {BRAND, t} from '@/lib/copy'
import {TabBar} from '@/components/tab-bar'
import {AppBar} from '@/components/app-bar'
export const metadata:Metadata={title:BRAND.name,description:t.homeSubtitle}  // ไอคอนแท็บ/iPhone มาจาก app/icon.png + app/apple-icon.png
export const viewport:Viewport={viewportFit:'cover',themeColor:'#FAF7F2',width:'device-width',initialScale:1}
// pb เผื่อความสูง tab bar (3.5rem) + ระยะห่าง + safe area ให้ปุ่มล่างสุดของทุกหน้าเลื่อนขึ้นมาเหนือแถบได้
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body><main className="mx-auto min-h-dvh w-full max-w-[480px] bg-paper px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 sm:my-6 sm:min-h-[844px] sm:rounded-[32px] sm:border sm:border-zinc-200"><AppBar/>{children}</main><TabBar/></body></html>}
