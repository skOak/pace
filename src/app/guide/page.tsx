'use client';

import { guideContent } from '@/lib/guide-content';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { useEffect, useState } from 'react';

// Extract headings from markdown content
function useHeadings(markdown: string) {
  const [headings, setHeadings] = useState<{ text: string; level: number }[]>([]);

  useEffect(() => {
    // Match ## and ### headings
    const matches = Array.from(markdown.matchAll(/^(#{2,3})\s+(.+)$/gm));
    const parsed = matches.map(match => ({
      level: match[1].length,
      text: match[2].trim(),
    }));
    setHeadings(parsed);
  }, [markdown]);

  return headings;
}

export default function GuidePage() {
  const headings = useHeadings(guideContent);

  const scrollToHeading = (text: string) => {
    const elements = Array.from(document.querySelectorAll('h2, h3'));
    const target = elements.find(el => el.textContent === text);
    if (target) {
      // Offset slightly to account for fixed headers if any
      const y = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-8">
        
      {/* Left Sidebar Table of Contents (hidden on mobile) */}
      <aside className="hidden md:block w-48 flex-shrink-0 pt-2">
        <div className="sticky top-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            目 录 (Contents)
          </h4>
          <nav className="flex flex-col gap-2">
            {headings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollToHeading(h.text)}
                className={`text-left text-sm hover:text-blue-600 transition-colors ${
                  h.level === 3 ? 'pl-4 text-gray-500' : 'font-medium text-gray-700'
                }`}
              >
                {h.text}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Markdown Content Area */}
      <main className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-full bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100 min-h-[80vh]">
          <MarkdownViewer content={guideContent} />
        </div>
      </main>

    </div>
  );
}
