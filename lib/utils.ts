export function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

export function toInputDate(value: string) {
  return value.slice(0, 10);
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

export function hoursUntil(value: string) {
  return (new Date(value).getTime() - Date.now()) / 36e5;
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
