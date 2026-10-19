// Vercel CLI가 한글 PC 이름을 HTTP User-Agent에 넣는 경우만 현재 프로세스에서 보정합니다.
// 시스템 컴퓨터 이름·인증 정보·프로젝트 설정은 변경하지 않습니다.
const os = require("node:os");
const { syncBuiltinESMExports } = require("node:module");
if (/[^\x20-\x7e]/.test(os.hostname())) {
  os.hostname = () => "family-invention-local";
  syncBuiltinESMExports();
}
