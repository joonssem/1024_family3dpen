import type { NextConfig } from "next";

const config: NextConfig = {
  // 빌드 작업을 스레드에서 실행해 제한된 로컬 환경의 프로세스 생성 제약에 대응합니다.
  experimental: { workerThreads: true, useTypeScriptCli: false, cpus: 2 },
};

export default config;
