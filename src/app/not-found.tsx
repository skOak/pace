import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-gray-900 border-b-4 border-blue-600 inline-block pb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800">页面未找到</h2>
        <p className="text-gray-500 text-sm">
          很抱歉，您访问的页面可能已经被删除、更名或暂时不可用。
        </p>
        <div className="pt-4 mt-8">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
