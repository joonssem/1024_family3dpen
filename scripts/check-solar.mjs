// 실행 중인 앱에 수업용 예시 한 건을 요청합니다. 키·환경파일·응답 본문은 출력하지 않습니다.
const target = new URL("/api/ideas", process.argv[2] || "http://localhost:3000");
const started = performance.now();
const reasons = {
  disabled: "SOLAR_API_KEY와 SOLAR_ENABLED=true를 서버 환경에 등록해 주세요.",
  unconfigured: "SOLAR_API_ENDS_AT에 시간대가 포함된 종료 시각을 등록해 주세요.",
  expired: "설정한 AI 이용 시간이 끝났습니다.",
  limited: "설정한 요청 한도에 도달했습니다.",
  unavailable: "Solar 또는 공유 카운터 연결을 확인해 주세요. 프로덕션에는 공유 카운터가 필요합니다.",
};

try {
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem: "연필이 책상에서 자꾸 굴러가요", mode: "initial", previous: [] }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (!response.ok) {
    console.error(`서버 응답: HTTP ${response.status}. 입력 처리와 배포 상태를 확인해 주세요.`);
    process.exitCode = 1;
  } else if (data.source === "ai" && Array.isArray(data.ideas) && data.ideas.length === 3) {
    console.log(`Solar 연결 성공: 아이디어 카드 3장, ${seconds}초.`);
    console.log("실제 제작 가능성은 교사 확인이 필요합니다.");
  } else if (data.source === "prepared") {
    console.log(`예비 카드로 전환됨: ${seconds}초.`);
    console.log(reasons[data.reason] || "AI 활성화 설정을 확인해 주세요.");
    process.exitCode = 2;
  } else {
    console.error("예상한 카드 응답이 아닙니다. 서버 배포 버전을 확인해 주세요.");
    process.exitCode = 1;
  }
} catch {
  console.error("연결하지 못했습니다. npm run dev로 앱을 실행한 뒤 다시 요청해 주세요. 제한 시간은 15초입니다.");
  process.exitCode = 1;
}
