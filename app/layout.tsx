import type {Metadata, Viewport} from 'next'
import './globals.css'
import {BRAND, t} from '@/lib/copy'
import {TabBar} from '@/components/tab-bar'
import {AppBar} from '@/components/app-bar'

export const metadata: Metadata = {title: BRAND.name, description: t.homeSubtitle}
export const viewport: Viewport = {viewportFit: 'cover', themeColor: '#806149', width: 'device-width', initialScale: 1}

// pb เผื่อความสูง tab bar (3.5rem) + ระยะห่าง + safe area ให้ปุ่มล่างสุดของทุกหน้าเลื่อนขึ้นมาเหนือแถบได้
export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="rl-shell">
          <AppBar />
          <main id="main-content" className="rl-surface">{children}</main>
          <TabBar />
        </div>
      </body>
    </html>
  )
}
