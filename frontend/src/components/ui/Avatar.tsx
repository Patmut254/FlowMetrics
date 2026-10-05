import { cn } from "@/lib/cn";
import { avatarTone, initials } from "@/lib/format";

const SIZES = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-14 text-lg" };

export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold", SIZES[size], avatarTone(name), className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
