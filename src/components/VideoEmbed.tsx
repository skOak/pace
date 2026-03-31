import React from 'react';

interface VideoEmbedProps {
  text?: string;
}

function extractVideoInfo(text: string) {
  // Bilibili
  const bvidMatch = text.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  if (bvidMatch) return { type: 'bilibili', id: bvidMatch[1] };
  
  // YouTube
  const ytMatch = text.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  
  return null;
}

export function VideoEmbed({ text }: VideoEmbedProps) {
  if (!text) return null;
  const videoInfo = extractVideoInfo(text);
  if (!videoInfo) return null;

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-md mb-4 border border-gray-200">
      {videoInfo.type === 'bilibili' && (
        <>
          <iframe
            src={`https://player.bilibili.com/player.html?bvid=${videoInfo.id}&page=1&high_quality=1&as_wide=1&danmaku=0&autoplay=0`}
            className="w-full h-full border-0 absolute top-0 left-0"
            allowFullScreen
            sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts"
            referrerPolicy="no-referrer"
          />
          <a
            href={`https://www.bilibili.com/video/${videoInfo.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 bg-black/60 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors flex items-center gap-1.5 z-10 border border-white/10"
            title="B站限制了外链播放器的最高画质。点击前往B站官网观看1080P超清版本。"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 8h-1V6h-2v2h-1.5V6h-2v2H6a2 2 0 00-2 2v8a2 2 0 002 2h13a2 2 0 002-2v-8a2 2 0 00-2-2zm-6 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            去B站看超清
          </a>
        </>
      )}
      {videoInfo.type === 'youtube' && (
        <iframe
          src={`https://www.youtube.com/embed/${videoInfo.id}`}
          className="w-full h-full border-0 absolute top-0 left-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
