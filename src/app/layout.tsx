import { Geist } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { headers } from 'next/headers';
import ContextProvider from '@/context';
import { Navbar } from '@/components/ui/navbar';
import ClientLayout from '@/components/ClientLayout';
import "./globals.css";
import type { Metadata } from "next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Infi",
  description: "The Premier Liquidity Hub on Pharos Network",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get('cookie')  
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ContextProvider cookies={cookies}>
          <ClientLayout>
            <div className="px-8">
              <Navbar />
              <div className="pt-16">
                {children}
              </div>
            </div>
          </ClientLayout>
        </ContextProvider>
      </body>
    </html>
  );
}
