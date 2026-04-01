import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  content?: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  if (!content) return null;

  return (
    <div className="text-gray-800 text-sm leading-relaxed overflow-hidden break-words pb-4 md:text-base markdown-body">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2" {...props} />,
          p: ({node, ...props}) => <p className="mb-3" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          a: ({node, ...props}) => {
            const href = props.href || '';
            const isVideo = href.includes('bilibili.com/video/') || 
                            href.includes('youtube.com/watch') || 
                            href.includes('youtu.be/') || 
                            href.includes('xiaohongshu.com/explore') || 
                            href.includes('xhslink.com') ||
                            href.includes('vimeo.com/') ||
                            href.includes('zhihu.com/zvideo') ||
                            href.includes('douyin.com/video') ||
                            href.includes('v.douyin.com');
            if (isVideo) {
              return (
                 <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/50 text-slate-400 rounded-md text-[11px] border border-slate-200 select-none cursor-not-allowed mx-1 align-middle" title="已自动提取至最上方专属播放器">
                   🎬 视频已装载至上方
                 </span>
              );
            }
            return <a className="text-blue-600 hover:underline" target="_blank" rel="noreferrer" {...props} />;
          },
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-200 pl-4 py-1 italic text-gray-600 mb-3" {...props} />,
          code: ({node, ...props}) => <code className="bg-gray-100 rounded px-1.5 py-0.5 text-red-500 font-mono text-xs" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
