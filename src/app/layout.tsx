import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Khata",
  description: "Udhaar ka hisaab",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: pinch-zoom stays available. Locking it out would make the
  // ledger unreadable for anyone who needs to zoom in on a number.
  themeColor: "#faf8f5",
  viewportFit: "cover",
  // The add-entry sheet sits at the bottom of the screen, which is exactly
  // where the Android keyboard appears. resizes-content shrinks the layout
  // viewport when the keyboard opens, so the sheet rides above it instead of
  // being buried under it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
