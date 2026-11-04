import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["bcryptjs", "esbuild", "libxmljs2"],
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/courses/*/export": [
      "./vendor/scorm/**/*",
      "./src/player/**/*",
      "./src/components/learner.tsx",
      "./src/lib/**/*",
      "./src/app/globals.css",
      "./node_modules/@fontsource/inter/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default config;
