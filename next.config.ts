import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev logs print Server Function arguments, which would include passwords typed at login.
  logging: {
    serverFunctions: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
