import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import type { CSSProperties } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pesa Lens: see where your M-Pesa money goes",
  description:
    "Upload your M-Pesa statement PDF and get a full dashboard. Everything is read on your device and never uploaded.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E7C4A",
};

const toastStyle = {
  "--normal-bg": "#14211A",
  "--normal-text": "#FFFFFF",
  "--normal-border": "#14211A",
} as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="bottom-right" style={toastStyle} />
      </body>
    </html>
  );
}
