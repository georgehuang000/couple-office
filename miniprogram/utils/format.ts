export function formatDateTime(value: number | null | undefined): string {
  if (!value) return "未设置";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hour}:${minute}`;
}

export function formatTime(value: number | null | undefined): string {
  if (!value) return "全天";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function initials(value: string): string {
  const text = String(value || "我").trim();
  return text.slice(-2);
}

export function todayString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthGrid(year: number, month: number): Array<{ key: string; day: number; date: string; muted: boolean }> {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { key: `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`, day: current.getDate(), date: todayString(current), muted: current.getMonth() !== month };
  });
}
