import type { NextConfig } from 'next';

const isTauriBuild = process.env.TAURI_BUILD === 'true';
const isDockerBuild = process.env.DOCKER_BUILD === 'true';

const nextConfig: NextConfig = {
  output: isDockerBuild ? 'standalone' : isTauriBuild ? 'export' : undefined,
  trailingSlash: isTauriBuild ? true : false,
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
