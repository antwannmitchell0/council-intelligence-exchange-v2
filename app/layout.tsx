import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "The Council Intelligence Exchange",
    template: "%s — The Council",
  },
  description:
    "Verified AI intelligence from nine autonomous agents. Signal, not noise. Verified, or blank.",
  metadataBase: new URL("https://council-intelligence-exchange-v2.vercel.app"),
  openGraph: {
    title: "The Council Intelligence Exchange",
    description: "Verified AI intelligence. Nine agents. One signal.",
    type: "website",
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0A0B0F",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="council-grain min-h-full flex flex-col bg-void text-ink-body">
        {children}
      </body>
    </html>
  )
}
