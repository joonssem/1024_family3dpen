type LocalCounter = { minute: number; day: number; minuteCount: number; dayCount: number };
const local: LocalCounter = { minute: -1, day: -1, minuteCount: 0, dayCount: 0 };

// Lua는 두 한도를 한 번에 확인·증가시킵니다. 입력·IP·기기 식별자는 저장하지 않습니다.
const reserveScript = `
local m = tonumber(redis.call('GET', KEYS[1]) or '0')
local d = tonumber(redis.call('GET', KEYS[2]) or '0')
if m >= tonumber(ARGV[1]) or d >= tonumber(ARGV[2]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 120)
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], 172800)
return 1`;

function limit(value: string | undefined, fallback: number, maximum: number) {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) throw new Error("limit-config");
  return result;
}

export async function reserveRequest(signal: AbortSignal): Promise<boolean> {
  const perMinute = limit(process.env.SOLAR_MAX_REQUESTS_PER_MINUTE, 30, 60);
  const perDay = limit(process.env.SOLAR_MAX_REQUESTS_PER_DAY, 200, 1000);
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const day = Math.floor((now + 9 * 3600000) / 86400000); // 한국 표준시 기준 날짜
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".upstash.io") || endpoint.username || endpoint.password || endpoint.search || endpoint.pathname !== "/") throw new Error("limit-config");
    const scope = process.env.SOLAR_BUDGET_SCOPE || "family-2026-10-24";
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(scope)) throw new Error("limit-config");
    const prefix = `workshop:{${scope}}`;
    const response = await fetch(endpoint, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", reserveScript, "2", `${prefix}:minute:${minute}`, `${prefix}:day:${day}`, String(perMinute), String(perDay)]),
      signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]), cache: "no-store",
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error("limit-unavailable"); }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("result" in result) || (result.result !== 0 && result.result !== 1)) throw new Error("limit-unavailable");
    return result.result === 1;
  }
  // 개발 서버에서만 메모리 제한을 허용합니다.
  if (process.env.NODE_ENV === "production" || url || token) throw new Error("shared-limit-required");
  if (local.minute !== minute) { local.minute = minute; local.minuteCount = 0; }
  if (local.day !== day) { local.day = day; local.dayCount = 0; }
  if (local.minuteCount >= perMinute || local.dayCount >= perDay) return false;
  local.minuteCount++; local.dayCount++;
  return true;
}
