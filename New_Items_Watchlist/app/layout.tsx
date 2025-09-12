import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Domestic Items Watchlist",
  description: "Dashboard for domestic-only, not-in-stock item candidates",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}