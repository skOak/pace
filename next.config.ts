import type { NextConfig } from "next";
import os from 'os';

// 动态获取本机所有的 IPv4 局域网 IP
function getLocalIPs() {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  // 将当前本机的所有动态局域网 IP 加入 Next.js 白名单，防止路由器重分配导致失效
  allowedDevOrigins: [...getLocalIPs(), 'localhost'],
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
