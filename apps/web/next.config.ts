import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@nvb/schema",
    "@nvb/notion",
    "@nvb/llm",
    "@nvb/mcp",
    "@nvb/prompts",
    "@nvb/workflows",
    "@nvb/github",
  ],
};

export default nextConfig;
