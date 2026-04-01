import React from 'react';

interface VideoEmbedProps {
  text?: string;
}

function extractMultipleVideoInfo(text: string) {
  const results: Array<{ type: string, id: string, url?: string, hash?: string, index: number }> = [];
  
  // Bilibili
  const biliRegex = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/g;
  let match;
  while ((match = biliRegex.exec(text))) results.push({ type: 'bilibili', id: match[1], index: match.index });

  // YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/ig;
  while ((match = ytRegex.exec(text))) results.push({ type: 'youtube', id: match[1], index: match.index });

  // Xiaohongshu
  const xhsRegex = /(?:xiaohongshu\.com\/explore\/|xhslink\.com\/)([a-zA-Z0-9_]+)/g;
  while ((match = xhsRegex.exec(text))) results.push({ type: 'xiaohongshu', id: match[1], url: match[0], index: match.index });

  // Vimeo
  const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:[^\/\s"]+\/)*(\d+)(?:\/([a-zA-Z0-9]+))?/ig;
  while ((match = vimeoRegex.exec(text))) results.push({ type: 'vimeo', id: match[1], hash: match[2], index: match.index });

  // Zhihu
  const zhihuRegex = /zhihu\.com\/zvideo\/(\d+)/g;
  while ((match = zhihuRegex.exec(text))) results.push({ type: 'zhihu', id: match[1], url: match[0], index: match.index });

  // Douyin
  const douyinRegex = /(?:douyin\.com\/video\/(\d+)|v\.douyin\.com\/([a-zA-Z0-9_]+))/g;
  while ((match = douyinRegex.exec(text))) results.push({ type: 'douyin', id: match[1] || match[2], url: match[0], index: match.index });

  return results.sort((a, b) => a.index - b.index).slice(0, 3);
}

export function VideoEmbed({ text }: VideoEmbedProps) {
  if (!text) return null;
  const videos = extractMultipleVideoInfo(text);
  if (videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-4">
      {videos.map((videoInfo, idx) => (
        <div key={`${videoInfo.id}-${idx}`} className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-md border border-gray-200 shrink-0">
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
      {videoInfo.type === 'vimeo' && (
        <iframe
          src={`https://player.vimeo.com/video/${videoInfo.id}${videoInfo.hash ? `?h=${videoInfo.hash}` : ''}`}
          className="w-full h-full border-0 absolute top-0 left-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}
      {videoInfo.type === 'zhihu' && (
        <a 
          href={`https://${videoInfo.url}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-colors absolute top-0 left-0"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#0066FF] text-white flex items-center justify-center mb-3 shadow-md">
             <span className="text-xl font-bold">知乎</span>
          </div>
          <span className="text-[#0066FF] font-semibold tracking-wide">🔗 点击前往知乎查看视频</span>
        </a>
      )}
      {videoInfo.type === 'douyin' && (
        <a 
          href={`https://${videoInfo.url}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 hover:from-black hover:to-black transition-colors absolute top-0 left-0"
        >
          <div className="w-16 h-16 rounded-2xl bg-black text-white border border-white/20 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
             <span className="text-xl font-bold">抖音</span>
          </div>
          <span className="text-white font-semibold tracking-wide">🔗 点击前往抖音查看短视频</span>
        </a>
      )}
      {videoInfo.type === 'xiaohongshu' && (
        <a 
          href={`https://${videoInfo.url}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 transition-colors absolute top-0 left-0"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#ff2442] text-white flex items-center justify-center mb-3 shadow-md">
             <span className="text-xl font-bold">小红书</span>
          </div>
          <span className="text-[#ff2442] font-semibold tracking-wide">🔗 点击前往小红书查看图文/视频</span>
        </a>
      )}
        </div>
      ))}
    </div>
  );
}
