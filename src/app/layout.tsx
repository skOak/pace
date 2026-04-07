import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { VisitorTracker } from "@/components/providers/VisitorTracker";

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
      <head>
        {/* iOS 真机调试专用内核崩溃拦截器 (按需取消注释)
        <script dangerouslySetInnerHTML={{ __html: `
          window.onerror = function(msg, url, line, col, err) {
            var div = document.createElement('div');
            div.style = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:red;color:white;padding:10px;font-size:12px;word-break:break-all;';
            div.innerText = 'Global Error: ' + msg + ' at ' + (url ? url.split('/').pop() : 'unknown') + ':' + line;
            if(document.body) document.body.appendChild(div); else window.addEventListener('DOMContentLoaded', function() { document.body.appendChild(div); });
          };
          var oldErr = console.error;
          console.error = function() {
            oldErr.apply(console, arguments);
            var msg = Array.from(arguments).map(function(a) { 
              try { return a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); } 
            }).join(' ');
            if (msg.indexOf('Error') > -1 || msg.indexOf('Hydration') > -1 || msg.indexOf('Syntax') > -1 || msg.indexOf('Type') > -1 || msg.indexOf('Minified') > -1) {
              var div = document.createElement('div');
              div.style = 'position:fixed;top:50px;left:0;right:0;z-index:99999;background:purple;color:white;padding:10px;font-size:12px;word-break:break-all;';
              div.innerText = 'React Error: ' + msg.substring(0, 200);
              if(document.body) document.body.appendChild(div); else window.addEventListener('DOMContentLoaded', function() { document.body.appendChild(div); });
            }
          };
        ` }} />
        */}
      </head>
      <body className="min-h-full flex flex-col bg-[#F8F9FA]" suppressHydrationWarning>
        <AuthProvider>
          <VisitorTracker />
          <Sidebar />
          <div className="flex-1 md:pl-72 flex flex-col pb-16 md:pb-0">
            <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8">
              {children}
            </main>
          </div>
          <MobileNav />
        </AuthProvider>
      </body>
    </html>
  );
}
