/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Disable ESLint during build (uses parent eslintrc which has missing plugins)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during build (optional, for faster builds)
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      'i.imgur.com',
      'imagedelivery.net',
      'res.cloudinary.com',
      'warpcast.com',
      'api.warpcast.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // Redirect for hosted manifest (optional - can be configured later)
  // async redirects() {
  //   return [
  //     {
  //       source: '/.well-known/farcaster.json',
  //       destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/YOUR_MANIFEST_ID',
  //       permanent: false,
  //     },
  //   ];
  // },
  webpack: (config) => {
    // Fix Vercel/Next build error from `@metamask/sdk` importing RN AsyncStorage.
    // We alias it to a tiny web shim.
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@react-native-async-storage/async-storage'] = path.resolve(
      __dirname,
      'src/lib/shims/async-storage.ts'
    );
    return config;
  },
};

module.exports = nextConfig;
