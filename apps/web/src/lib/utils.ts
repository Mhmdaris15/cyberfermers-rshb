import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRUB(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function relativeDate(d: string | Date, base = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.round((date.getTime() - base.getTime()) / 86_400_000);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  if (diff > 0 && diff < 7) return `через ${diff} ${plural(diff, ["день", "дня", "дней"])}`;
  if (diff < 0 && diff > -7) return `${-diff} ${plural(-diff, ["день", "дня", "дней"])} назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(d);
}

export function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
}
