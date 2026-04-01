import Link from 'next/link';
import { Home, Inbox, Repeat, BookOpen } from 'lucide-react';

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/80 backdrop-blur-xl md:hidden">
      <Link href="/" className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-blue-600">
        <Home className="h-6 w-6" />
        <span className="text-[10px] font-medium">今天</span>
      </Link>
      <Link href="/inbox" className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-blue-600">
        <Inbox className="h-6 w-6" />
        <span className="text-[10px] font-medium">收集箱</span>
      </Link>
      <Link href="/habits" className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-blue-600">
        <Repeat className="h-6 w-6" />
        <span className="text-[10px] font-medium">习惯</span>
      </Link>
      <Link href="/guide" className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-blue-600">
        <BookOpen className="h-6 w-6" />
        <span className="text-[10px] font-medium">指南</span>
      </Link>
    </nav>
  );
}
