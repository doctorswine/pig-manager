import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // next dev가 AGENTS.md·CLAUDE.md에 규칙 블록을 자동으로 넣지 않도록 한다(프로젝트 규칙 파일 보호).
  agentRules: false,
};

export default nextConfig;
