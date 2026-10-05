import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import { humanize } from "@/lib/format";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    title: "Revenue",
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/subscriptions", label: "Subscriptions", icon: Layers },
      { to: "/transactions", label: "Transactions", icon: CreditCard },
    ],
  },
  {
    title: "Workspace",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const org = user?.organization;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 animate-fade-in bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200",
          "lg:inset-y-3 lg:left-3 lg:translate-x-0 lg:rounded-3xl lg:border lg:shadow-card",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-[4.5rem] items-center justify-between px-5">
          <Logo />
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-3 lg:hidden" aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">{section.title}</p>
              <ul className="space-y-1">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-brand-600 text-white shadow-[0_8px_18px_-8px_var(--brand-600)] dark:bg-brand-500"
                            : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn("size-[18px]", isActive ? "text-white" : "text-muted group-hover:text-ink-2")}
                            aria-hidden
                          />
                          {label}
                          {isActive && <span className="ml-auto size-1.5 rounded-full bg-white/80" aria-hidden />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {org && (
          <div className="m-3 rounded-2xl hero-pattern p-4 text-white shadow-[0_12px_24px_-12px_var(--brand-700)]">
            <p className="text-[11px] font-semibold tracking-wider text-white/70 uppercase">Workspace</p>
            <p className="mt-1 truncate text-sm font-semibold">{org.name}</p>
            <p className="mt-0.5 text-xs text-white/60">
              {org.member_count} {org.member_count === 1 ? "member" : "members"} · {user?.role ? humanize(user.role) : "Member"}
            </p>
            <NavLink
              to="/settings?tab=workspace"
              onClick={onClose}
              className="mt-3 inline-flex rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
            >
              Manage workspace
            </NavLink>
          </div>
        )}
      </aside>
    </>
  );
}
