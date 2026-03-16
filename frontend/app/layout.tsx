import type { Metadata } from 'next'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'
import { NotificationProvider } from '@/context/NotificationContext'

export const metadata: Metadata = {
  title: 'STARKSON - IT Support & Cybersecurity',
  description: 'IT Support & Cybersecurity Incident Monitoring System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </NotificationProvider>
      </body>
    </html>
  )
}