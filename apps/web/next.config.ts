import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@concert/types', '@concert/shared', '@concert/validation', '@concert/business-logic'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' }
    ]
  }
};

export default nextConfig;
