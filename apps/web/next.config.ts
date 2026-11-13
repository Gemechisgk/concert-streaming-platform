import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@concert/types', '@concert/shared', '@concert/validation', '@concert/business-logic'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' }
    ]
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|gif|webp|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
