import crypto from "node:crypto";

export type JsonObject = Record<string, unknown>;

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function fail(code: string, message: string, retryable = false): never {
  throw new DomainError(code, message, retryable);
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("base64url")}`;
}

export function randomInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as JsonObject;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stringField(payload: JsonObject, key: string, options: { required?: boolean; min?: number; max?: number } = {}): string {
  const raw = payload[key];
  if (raw === undefined || raw === null) {
    if (options.required) fail("VALIDATION_ERROR", `${key} 为必填项。`);
    return "";
  }
  if (typeof raw !== "string") fail("VALIDATION_ERROR", `${key} 格式不正确。`);
  const value = raw.trim();
  if (options.required && !value) fail("VALIDATION_ERROR", `${key} 为必填项。`);
  if (options.min && value.length < options.min) fail("VALIDATION_ERROR", `${key} 至少需要 ${options.min} 个字符。`);
  if (options.max && value.length > options.max) fail("VALIDATION_ERROR", `${key} 最多允许 ${options.max} 个字符。`);
  return value;
}

export function optionalNumber(payload: JsonObject, key: string): number | null {
  const value = payload[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) fail("VALIDATION_ERROR", `${key} 格式不正确。`);
  return value;
}

export function enumField<T extends string>(payload: JsonObject, key: string, allowed: readonly T[], fallback?: T): T {
  const value = payload[key];
  if ((value === undefined || value === null || value === "") && fallback) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) fail("VALIDATION_ERROR", `${key} 取值不正确。`);
  return value as T;
}

export function booleanField(payload: JsonObject, key: string, fallback = false): boolean {
  const value = payload[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") fail("VALIDATION_ERROR", `${key} 格式不正确。`);
  return value;
}

export function dateField(payload: JsonObject, key: string, required = false): string | null {
  const value = payload[key];
  if (value === undefined || value === null || value === "") {
    if (required) fail("VALIDATION_ERROR", `${key} 为必填项。`);
    return null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("VALIDATION_ERROR", `${key} 必须是 YYYY-MM-DD。`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail("VALIDATION_ERROR", `${key} 不是有效日期。`);
  return value;
}

export function expectedVersion(payload: JsonObject): number {
  const value = payload.expected_version;
  if (!Number.isInteger(value) || Number(value) < 1) fail("VALIDATION_ERROR", "缺少有效的 expected_version。");
  return Number(value);
}

export function assertVersion(record: JsonObject, version: number): void {
  if (Number(record.version) !== version) fail("VERSION_CONFLICT", "内容已被另一台设备更新，请刷新后重试。");
}

export function clampPageSize(payload: JsonObject): number {
  const value = payload.page_size;
  if (value === undefined) return 20;
  if (!Number.isInteger(value) || Number(value) < 1) fail("VALIDATION_ERROR", "page_size 格式不正确。");
  return Math.min(Number(value), 50);
}

export function localDate(timestamp: number, timezone = "Asia/Shanghai"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}

export function calendarDayDiff(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function togetherDays(startDate: string | null, today: string): number | null {
  if (!startDate) return null;
  const diff = calendarDayDiff(startDate, today);
  return diff >= 0 ? diff + 1 : diff;
}

export function nextAnniversary(originalDate: string, today: string): { next_date: string; days_until: number } {
  const [month, day] = originalDate.slice(5).split("-").map(Number);
  let year = Number(today.slice(0, 4));
  const normalized = (targetYear: number) => {
    if (month === 2 && day === 29) {
      const leap = new Date(Date.UTC(targetYear, 1, 29)).getUTCDate() === 29;
      return `${targetYear}-${leap ? "02-29" : "02-28"}`;
    }
    return `${targetYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  let next = normalized(year);
  if (next < today) next = normalized(++year);
  return { next_date: next, days_until: calendarDayDiff(today, next) };
}
