import type { NextConfig } from 'next';
import path from 'node:path';

const isTauriBuild = process.env.TAURI_BUILD === 'true';
const isDockerBuild = process.env.DOCKER_BUILD === 'true';

const nextConfig: NextConfig = {
  output: isDockerBuild ? 'standalone' : isTauriBuild ? 'export' : undefined,
  trailingSlash: isTauriBuild ? true : false,
  // 将文件监听根目录锁定在 web/，避免 Turbopack 监听上层后端 node_modules 导致内存暴涨
  turbopack: {
    root: path.resolve(__dirname),
  },
  // API 代理仅在非静态导出模式下生效
  ...(isTauriBuild ? {} : {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'}/api/:path*`,
        },
      ];
    },
  }),
};

export default nextConfig;
