import { z } from "zod";

export const ideaSchema = z.object({
  name: z.string().min(1).max(30),
  problem: z.string().min(1).max(100),
  parts: z.array(z.object({ name: z.string().min(1).max(30), shape: z.string().min(1).max(60) })).min(1).max(3),
  assembly: z.string().min(1).max(140),
});
export const ideasSchema = z.object({ ideas: z.array(ideaSchema).length(3) });
export type Idea = z.infer<typeof ideaSchema>;

// 실제 제작 검증 전의 예비 힌트. 한 항목은 실제로 만드는 조각 한 개입니다.
const examples: Idea[] = [
  { name: "연필 멈춤 산", problem: "책상 위 연필이 굴러가는 것을 막는 모양이에요.", parts: [{ name: "바닥", shape: "6cm 네모 한 장" }, { name: "멈춤 벽", shape: "높이 2cm 삼각형 한 장" }], assembly: "네모 바닥 가운데 삼각형을 세워 붙여요. 연필을 옆에 놓고 멈추는지 살펴봐요." },
  { name: "작은 물건 자리표", problem: "지우개처럼 작은 물건을 놓을 자리를 정해요.", parts: [{ name: "자리판", shape: "7cm 납작한 동그라미 한 장" }, { name: "이름표", shape: "3cm 네모 한 장" }], assembly: "동그라미 뒤쪽에 네모를 세워 붙여요. 어떤 물건의 자리인지 이름을 붙여요." },
  { name: "메모 응원대", problem: "오늘 기억할 메모를 세워 두는 모양이에요.", parts: [{ name: "받침", shape: "6cm 네모 한 장" }, { name: "앞 벽", shape: "높이 1cm 직사각형 한 장" }, { name: "뒤 벽", shape: "높이 3cm 직사각형 한 장" }], assembly: "받침 위에 앞 벽과 뒤 벽을 조금 떨어뜨려 세워요. 그 사이에 작은 메모를 기대어 봐요." },
  { name: "줄 감는 나비", problem: "사용하지 않는 줄을 한곳에 감아 정리해요.", parts: [{ name: "나비판", shape: "가운데가 잘록한 7cm 나비 모양 한 장" }], assembly: "평평한 나비판을 만들어요. 식은 뒤 가운데에 사용하지 않는 줄을 느슨하게 감아 봐요." },
  { name: "책갈피 친구", problem: "읽던 책의 자리를 쉽게 찾도록 도와줘요.", parts: [{ name: "책갈피", shape: "길이 8cm 납작한 직사각형 한 장" }, { name: "표시", shape: "2cm 동그라미 한 장" }], assembly: "긴 네모 끝에 동그라미를 평평하게 이어 붙여요. 두껍지 않게 만들어요." },
  { name: "나만의 물건 표지판", problem: "자주 찾는 물건의 위치를 알려줘요.", parts: [{ name: "받침", shape: "5cm 타원 한 장" }, { name: "표지판", shape: "4cm 네모 한 장" }], assembly: "받침 위에 표지판을 세워 붙여요. 물건이 있는 곳에 두고 찾기 쉬워졌는지 이야기해요." },
];

export function fallbackIdeas(problem: string, mode = "initial", previous: string[] = []): Idea[] {
  const start = /줄|선|엉/.test(problem) ? 3 : /메모/.test(problem) ? 2 : /잃|작은/.test(problem) ? 1 : 0;
  const pool = mode === "two" || mode === "simpler" ? examples.filter(idea => idea.parts.length <= 2) : examples;
  const offset = mode === "different" ? start + 3 : start;
  const ordered = Array.from({ length: pool.length }, (_, i) => pool[(offset + i) % pool.length]);
  const fresh = mode === "different" ? [...ordered.filter(idea => !previous.includes(idea.name)), ...ordered.filter(idea => previous.includes(idea.name))] : ordered;
  return fresh.slice(0, 3);
}
