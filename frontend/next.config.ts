import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/billing",
        destination: "/dashboard/billing",
        permanent: false,
      },
      {
        source: "/templates",
        destination: "/dashboard/templates",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/dashboard/settings",
        permanent: false,
      },
      {
        source: "/invoices",
        destination: "/dashboard/invoices",
        permanent: false,
      },
      {
        source: "/invoices/:path*",
        destination: "/dashboard/invoices/:path*",
        permanent: false,
      },
      {
        source: "/customers",
        destination: "/dashboard/customers",
        permanent: false,
      },
      {
        source: "/customers/:path*",
        destination: "/dashboard/customers/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

