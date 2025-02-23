import DuplicatePackageCheckerPlugin from "duplicate-package-checker-webpack-plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url); // ✅ Fix for ESM

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@tldraw/tldraw"],

  webpack: (config) => {
    // 🔹 Force Clerk to use Next.js’s built-in cookie module
    config.resolve.alias = {
      ...config.resolve.alias,
      cookie: require.resolve("next/dist/compiled/cookie"),
    };

    // 🔹 Add duplicate package checker
    config.plugins.push(
      new DuplicatePackageCheckerPlugin({
        verbose: true, // Show detailed duplicate package logs
        emitError: true, // Fail the build if duplicates are found
      })
    );

    return config;
  }
};

export default nextConfig;
