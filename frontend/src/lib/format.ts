import type { Granularity, ValueFormat } from "@/types";

let currency = "USD";
/** Set by the auth layer from the workspace's currency setting. */
export function setCurrency(code: string) {
  currency = code;
}

const toNumber = (value: number | string | null | undefined) =>
  Number(value ?? 0) || 0;

export function formatCurrency(
  value: number | string | null | undefined,
  options: { compact?: boolean; cents?: boolean } = {},
) {
  const amount = toNumber(value);
  const { compact = false, cents = !compact } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact && Math.abs(amount) >= 10_000 ? "compact" : "standard",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits:
      compact && Math.abs(amount) >= 10_000 ? 1 : cents ? 2 : 0,
  }).format(amount);
}

export function formatNumber(
  value: number | string | null | undefined,
  compact = false,
) {
  const amount = toNumber(value);
  return new Intl.NumberFormat("en-US", {
    notation: compact && Math.abs(amount) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(amount);
}

export function formatPercent(
  value: number | string | null | undefined,
  digits = 1,
) {
  if (value === null || value === undefined) return "-";
  return `${toNumber(value).toFixed(digits)}%`;
}

export function formatChange(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatValue(
  value: number | string | null | undefined,
  format: ValueFormat,
): string {
  if (value === null || value === undefined) return "-";
  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "number":
      return formatNumber(value);
    case "percent":
      return formatPercent(value);
    case "month":
      return formatMonth(String(value));
    case "status":
      return humanize(String(value));
    default:
      return String(value);
  }
}

/** Parse a YYYY-MM-DD string as a local date (avoids UTC off-by-one). */
export function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(
  value: string | null | undefined,
  style: "short" | "medium" = "medium",
) {
  if (!value) return "-";
  const date = value.length > 10 ? new Date(value) : parseDate(value);
  return date.toLocaleDateString(
    "en-US",
    style === "short"
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMonth(value: string, short = false) {
  return parseDate(value).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: short ? "2-digit" : "numeric",
  });
}

/** Axis / tooltip label for a series bucket. */
export function formatBucket(
  value: string,
  granularity: Granularity,
  long = false,
) {
  const date = parseDate(value);
  if (granularity === "month")
    return date.toLocaleDateString(
      "en-US",
      long
        ? { month: "long", year: "numeric" }
        : { month: "short", year: "2-digit" },
    );
  if (granularity === "week" && long)
    return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return date.toLocaleDateString(
    "en-US",
    long
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric" },
  );
}

export function relativeDay(value: string) {
  const date = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(value, "short");
}

export function humanize(value: string) {
  const labels: Record<string, string> = {
    past_due: "Past due",
    bank_transfer: "Bank transfer",
    paypal: "PayPal",
    paid: "Paid",
    organic: "Organic search",
    outbound: "Outbound sales",
    referral: "Referral",
    partner: "Partner",
  };
  if (labels[value]) return labels[value];
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const AVATAR_TONES = [
  "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
];

export function avatarTone(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
