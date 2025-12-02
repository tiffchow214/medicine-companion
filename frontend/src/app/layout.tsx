import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medication Companion",
  description: "Gentle medication companion to help elderly users and caregivers organize doses and schedules.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative">
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}


