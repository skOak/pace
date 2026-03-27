import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pace | 找到你的节奏",
  description: "建立对物理时间与认知时间的强映射",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8F9FA]" suppressHydrationWarning>
        <Sidebar />
        <div className="flex-1 md:pl-72 flex flex-col pb-16 md:pb-0">
          <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
