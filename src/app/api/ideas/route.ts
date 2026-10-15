import { NextResponse } from "next/server";
import { z } from "zod";
import { fallbackIdeas, ideaSchema } from "@/lib/ideas";

const requestSchema = z.object({
  problem: z.string().trim().min(1).max(50),
  mode: z.enum(["initial", "simpler", "two", "different"]).default("initial"),
  previous: z.array(ideaSchema).max(3).optional(),
});

// 첫 화면 확인 단계: 외부 API 호출 없이 수업 흐름을 체험합니다.
// Solar 연동은 서버 입력/응답 검증, 타임아웃, 배포 환경 요청 제한을 갖춘 뒤 추가합니다.
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "JSON 입력이 필요해요." }, { status: 415 });
  }
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 12000) return NextResponse.json({ error: "입력이 너무 길어요." }, { status: 413 });
  let payload: unknown;
  try {
    // 청크 요청도 크기를 제한합니다. 사용자 입력은 로그에 기록하지 않습니다.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("empty");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) { await reader.cancel(); return NextResponse.json({ error: "입력이 너무 길어요." }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return NextResponse.json({ error: "입력을 다시 확인해 주세요." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "불편을 1~50자로 적어 주세요." }, { status: 400 });
  return NextResponse.json({ ideas: fallbackIdeas(parsed.data.problem, parsed.data.mode, parsed.data.previous?.map(idea => idea.name)), source: "prepared" }, { headers: { "Cache-Control": "no-store" } });
}
