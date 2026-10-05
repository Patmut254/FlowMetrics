import type { ReactNode } from "react";
import { ArrowUpRight, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

function PreviewCard() {
  const bars = [38, 52, 46, 61, 58, 72, 69, 84, 80, 96];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/60">Monthly recurring revenue</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-white tabular">$32,546</p>
        </div>
        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-200">
          <ArrowUpRight className="size-3.5" aria-hidden /> +5.9%
        </span>
      </div>
      <div className="mt-6 flex h-24 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[4px]"
            style={{ height: `${h}%`, background: i === bars.length - 1 ? "#5eead4" : "rgb(255 255 255 / 0.16)" }}
          />
        ))}
      </div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} FlowMetrics. Built for modern SaaS teams.</p>
      </div>

      <div className="hero-pattern relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:p-14 xl:p-20">
        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-200">
            <span className="size-1.5 rounded-full bg-amber-300" aria-hidden /> Revenue intelligence for SaaS
          </span>
          <h2 className="mt-5 text-4xl leading-tight font-bold tracking-tight text-white">
            Every metric that matters, <span className="text-brand-300">calculated live</span> from your billing data.
          </h2>
          <p className="mt-4 text-base text-white/70">
            MRR, churn, retention cohorts and plan performance in one calm, focused workspace.
          </p>
          <div className="mt-10">
            <PreviewCard />
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-4 text-white/80">
            {[
              { icon: TrendingUp, label: "MRR movements" },
              { icon: Users, label: "Cohort retention" },
              { icon: ShieldCheck, label: "Workspace isolation" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4 text-brand-300" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
