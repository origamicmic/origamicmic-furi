import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "kuromoji/src/loader/NodeDictionaryLoader": {
        browser: "kuromoji/src/loader/BrowserDictionaryLoader",
      },
    },
  },
};

export default nextConfig;
