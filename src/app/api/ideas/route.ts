import { NextResponse } from "next/server";
import { z } from "zod";
import { fallbackIdeas, ideaSchema } from "@/lib/ideas";
import { generateIdeas } from "@/lib/solar.server";
import { reserveRequest } from "@/lib/request-limit.server";

export const runtime = "nodejs";
export const maxDuration = 20;

const requestSchema = z.object({
  problem: z.string().trim().min(1).max(50),
  mode: z.enum(["initial", "simpler", "two", "different"]).default("initial"),
  previous: z.array(ideaSchema).max(3).optional(),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "이 페이지에서 다시 요청해 주세요." }, { status: 403 });
  }
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
  const { problem, mode, previous = [] } = parsed.data;
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}|01[016789][\s-]?\d{3,4}[\s-]?\d{4}/i.test(problem)) {
    return NextResponse.json({ error: "연락처는 빼고 불편만 적어 주세요." }, { status: 400 });
  }
  const prepared = (reason: string) => NextResponse.json({
    ideas: fallbackIdeas(problem, mode, previous.map(idea => idea.name)), source: "prepared", reason,
  }, { headers: { "Cache-Control": "no-store" } });
  if (process.env.SOLAR_ENABLED !== "true" || !process.env.SOLAR_API_KEY?.trim()) return prepared("disabled");
  const end = process.env.SOLAR_API_ENDS_AT || "";
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(end) || !Number.isFinite(Date.parse(end))) return prepared("unconfigured");
  if (Date.now() >= Date.parse(end)) return prepared("expired");
  // 공유 카운터 시간까지 포함해 브라우저의 15초 제한보다 먼저 마무리합니다.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(13500)]);
  try {
    if (!(await reserveRequest(signal))) return prepared("limited");
    const ideas = await generateIdeas(problem, mode, previous, signal);
    return NextResponse.json({ ideas, source: "ai" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return prepared("unavailable");
  }
}
