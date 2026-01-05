const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com', 'jnex-images.s3.eu-north-1.amazonaws.com'],
    unoptimized: true,
  },
  serverExternalPackages: ['@prisma/client'],
  // Configure routes that should be treated as dynamic
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
        path: false,
        stream: false,
        constants: false,
        child_process: false,
        dns: false,
        http2: false,
        zlib: false,
      };
    }

    // Add resolver for lucide-react
    config.resolve.alias = {
      ...config.resolve.alias,
      'lucide-react': require.resolve('lucide-react'),
    };

    // Fix for missing @tailwindcss/forms in production build
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@tailwindcss/forms': require.resolve('@tailwindcss/forms'),
      };
    }

    return config;
  },
};

module.exports = withPWA(nextConfig);