// import { NextConfig } from "next";

// const nextConfig: NextConfig = {};

// export default nextConfig;
import mdx from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = mdx({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"], // include mdx
};

export default withMDX(nextConfig);
