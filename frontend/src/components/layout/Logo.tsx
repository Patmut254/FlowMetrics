import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand-600)" />
      <path d="M7 20.5c3.2 0 4.3-8.5 8.6-8.5 4.1 0 5 6.4 8.4 6.4" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24.2" cy="18.4" r="2.6" fill="#fbbf24" />
    </svg>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-[17px] font-bold tracking-tight", light ? "text-white" : "text-ink")}>
        Flow<span className={light ? "text-brand-300" : "text-brand-600 dark:text-brand-400"}>Metrics</span>
      </span>
    </span>
  );
}
