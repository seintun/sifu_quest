import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    })
    return config
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  org: process.env.SENTRY_ORG || "claude-thinking-buddy",
  project: process.env.SENTRY_PROJECT || "web",
  silent: process.env.NODE_ENV === 'production',
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
