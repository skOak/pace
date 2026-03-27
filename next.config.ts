import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/tencent-ocr',
        destination: 'https://ocr.tencentcloudapi.com/',
      },
    ];
  },
};

export default nextConfig;
