import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import ProtectedLayout from '@/components/ProtectedLayout'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EPI Dashboard - Order Analytics",
  description: "Secure order analytics and reporting dashboard for EPI",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ProtectedLayout>
          {children}
        </ProtectedLayout>
      </body>
    </html>
  )
}