import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FluxusTeam Kanban',
  description: 'Multi-user Kanban board',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  )
}
