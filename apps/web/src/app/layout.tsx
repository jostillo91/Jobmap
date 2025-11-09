import type { Metadata } from "next";
import Script from "next/script";
import "../styles/globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: {
    default: "JobMap - Find Jobs Near You",
    template: "%s | JobMap",
  },
  description: "Discover job opportunities on an interactive map. Search for jobs by location, salary, and employment type.",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  keywords: ["jobs", "job search", "employment", "career", "job map", "find jobs"],
  authors: [{ name: "JobMap" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://jobmap.app",
    siteName: "JobMap",
    title: "JobMap - Find Jobs Near You",
    description: "Discover job opportunities on an interactive map. Search for jobs by location, salary, and employment type.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JobMap - Find Jobs Near You",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JobMap - Find Jobs Near You",
    description: "Discover job opportunities on an interactive map",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "JobMap",
    description: "Discover job opportunities on an interactive map. Search for jobs by location, salary, and employment type.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://jobmap.app",
    applicationCategory: "JobSearchApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

