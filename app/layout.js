export const metadata = {
  title: "Badjr-Pay",
  description: "Invoicing Platform by BaDjR Tech",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/1.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Badjr-Pay" },
};

export const viewport = {
  themeColor: "#476C2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import Script from "next/script";
import Providers from "./providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/1.png" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <Providers>{children}</Providers>
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}</Script>
      </body>
    </html>
  );
}
