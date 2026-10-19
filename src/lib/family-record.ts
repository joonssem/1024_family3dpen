import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { z } from "zod";

const text = (max: number) => z.string().max(max);
export const familyRecordSchema = z.object({
  version: z.literal(1),
  title: text(80), date: text(40), place: text(100), promise: text(160),
  problem: text(50), firstIdea: text(140), invention: text(40), change: text(140),
  selected: text(30), assembly: text(200), childMemory: text(140), parentMemory: text(140),
  parts: z.array(z.object({
    name: text(30), shape: text(60), owner: z.enum(["함께", "학생", "보호자"]), done: z.boolean(),
  })).max(3),
});
export type FamilyRecord = z.infer<typeof familyRecordSchema>;
const maxBytes = 16000;

export function encodeRecord(record: FamilyRecord): string {
  const bytes = strToU8(JSON.stringify(familyRecordSchema.parse(record)));
  if (bytes.length > maxBytes) throw new Error("record-too-large");
  const packed = deflateSync(bytes, { level: 9 });
  return "v1." + btoa(Array.from(packed, byte => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeRecord(hash: string): FamilyRecord {
  const token = hash.replace(/^#/, "");
  if (token.length > 5000 || !/^v1\.[A-Za-z0-9_-]+$/.test(token)) throw new Error("invalid-record");
  const binary = atob(token.slice(3).replaceAll("-", "+").replaceAll("_", "/"));
  const packed = Uint8Array.from(binary, character => character.charCodeAt(0));
  // 잘못된 링크가 과도한 메모리를 사용하지 않도록 압축 해제 공간을 제한합니다.
  const unpacked = inflateSync(packed, { out: new Uint8Array(maxBytes + 1) });
  if (unpacked.length > maxBytes) throw new Error("record-too-large");
  return familyRecordSchema.parse(JSON.parse(strFromU8(unpacked)));
}

export function recordUrl(record: FamilyRecord, origin: string): string {
  const url = new URL("/record", origin);
  if (!/^https?:$/.test(url.protocol)) throw new Error("invalid-origin");
  url.hash = encodeRecord(record);
  return url.href;
}

export function isLocalOnly(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || /^127\./.test(hostname) || hostname === "0.0.0.0";
}

export function recordSections(record: FamilyRecord): { title: string; body: string }[] {
  return [
    { title: "01 / 발견한 불편", body: record.problem || "함께 이야기했어요." },
    { title: "02 / 아이의 첫 생각", body: record.firstIdea || "우리의 생각은 종이 활동지에 남겼어요." },
    { title: "03 / 우리 가족 발명품", body: record.invention || "우리 가족의 작은 발명" },
    { title: "04 / 우리가 바꾼 생각", body: record.change || "함께 방법을 찾아봤어요." },
    ...(record.selected ? [{ title: "참고한 힌트", body: record.selected }] : []),
    { title: "05 / 함께 만든 조각", body: record.parts.filter(part => part.name || part.shape).map((part, index) =>
      `${index + 1}. ${part.name || "이름 없는 조각"} · ${part.shape || "자유로운 모양"}\n${part.owner} · ${part.done ? "완성" : "도전 중"}`,
    ).join("\n\n") || "함께 그리고 만들었어요." },
    { title: "06 / 우리의 조립 순서", body: record.assembly || "서로 도우며 이어 붙였어요." },
    { title: "07 / 학생의 한마디", body: record.childMemory || "함께해서 즐거웠어요." },
    { title: "08 / 보호자의 한마디", body: record.parentMemory || "함께한 오늘을 기억할게요." },
  ];
}
