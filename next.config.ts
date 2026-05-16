import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      "kuromoji/src/loader/NodeDictionaryLoader": {
        browser: "kuromoji/src/loader/BrowserDictionaryLoader",
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "kuromoji/src/loader/NodeDictionaryLoader": "kuromoji/src/loader/BrowserDictionaryLoader",
      };
    }
    return config;
  },
};

export default nextConfig;
