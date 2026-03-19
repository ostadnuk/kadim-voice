import type { Metadata, Viewport } from 'next'
import { DM_Mono } from 'next/font/google'

import './globals.css'

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: 'Voice Signature Archive',
  description: 'Add your voice to the collective archive. One recording. Up to 30 seconds.',
}

export const viewport: Viewport = {
  themeColor: '#fafaf7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmMono.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
