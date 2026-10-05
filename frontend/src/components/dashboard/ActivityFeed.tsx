import { Link } from "react-router-dom";
import { AlertCircle, ArrowDownRight, ArrowUpRight, BadgeCheck, CircleSlash, Clock, Sparkles, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { formatCurrency, relativeDay } from "@/lib/format";
import type { ActivityEvent, ActivityType } from "@/types";

const META: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  trial_started: { icon: Sparkles, tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300" },
  converted: { icon: BadgeCheck, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" },
  subscribed: { icon: BadgeCheck, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" },
  upgraded: { icon: ArrowUpRight, tone: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300" },
  downgraded: { icon: ArrowDownRight, tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  cancelled: { icon: CircleSlash, tone: "bg-surface-3 text-ink-2" },
  trial_expired: { icon: Clock, tone: "bg-surface-3 text-ink-2" },
  payment_failed: { icon: AlertCircle, tone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" },
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <EmptyState title="No customer activity yet" description="Sign-ups, upgrades and cancellations will appear here." />;
  return (
    <ol className="relative space-y-1 px-3 pb-3">
      {events.map((event, index) => {
        const { icon: Icon, tone } = META[event.type];
        return (
          <li key={`${event.date}-${event.customer_id}-${event.type}-${index}`}>
            <Link to={`/customers/${event.customer_id}`} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  <span className="font-semibold">{event.customer}</span> <span className="text-ink-2">{event.description}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {relativeDay(event.date)} · {formatCurrency(event.amount)}
                  {event.type === "payment_failed" ? "" : "/mo"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
