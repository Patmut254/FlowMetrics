import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "hero" | "hero-outline";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_6px_16px_-8px_var(--brand-600)] dark:bg-brand-500 dark:hover:bg-brand-400",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2 shadow-card",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  hero: "bg-white text-brand-900 hover:bg-brand-50 shadow-sm",
  "hero-outline": "border border-white/20 bg-white/5 text-white hover:bg-white/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs gap-1.5 rounded-full",
  md: "h-10 px-4.5 text-sm gap-2 rounded-full",
  icon: "size-9 rounded-full justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
