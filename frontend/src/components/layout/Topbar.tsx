import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Check, ChevronDown, LogOut, Menu, Monitor, Moon, Palette, Search, Settings, Sun, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, Popover } from "@/components/ui/Controls";
import { useAuth } from "@/context/AuthContext";
import { ACCENTS, useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCurrency, relativeDay } from "@/lib/format";
import type { Paginated, ThemePreference, Transaction } from "@/types";

const ICON_CHIP =
  "relative grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-card transition-colors hover:text-ink hover:bg-surface-2";

const MODES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

/** Light/dark mode and accent colour, stored on this device. */
function AppearanceMenu() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const toast = useToast();

  // The account's saved theme is re-applied on sign-in, so persist it there too.
  const chooseMode = (next: ThemePreference) => {
    setTheme(next);
    api.patch("/auth/me/preferences/", { theme: next }).catch(() => toast.error("Couldn't save theme"));
  };

  return (
    <Popover
      className="w-64 p-3"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className={ICON_CHIP} aria-label="Appearance">
          <Palette className="size-[18px]" />
        </button>
      )}
    >
      {() => (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Mode</p>
          <div role="radiogroup" aria-label="Colour mode" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-3 p-1">
            {MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                role="radio"
                aria-checked={theme === value}
                onClick={() => chooseMode(value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                  theme === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-4 mb-2 text-xs font-semibold text-muted">Accent colour</p>
          <div role="radiogroup" aria-label="Accent colour" className="grid grid-cols-6 gap-2">
            {ACCENTS.map((option) => (
              <button
                key={option.value}
                role="radio"
                aria-checked={accent === option.value}
                aria-label={option.label}
                title={option.label}
                onClick={() => setAccent(option.value)}
                className={cn(
                  "grid size-8 place-items-center rounded-full text-white transition-transform hover:scale-110",
                  accent === option.value && "ring-2 ring-offset-2 ring-offset-surface",
                )}
                style={{ background: option.swatch, ["--tw-ring-color" as string]: option.swatch }}
              >
                {accent === option.value && <Check className="size-4" strokeWidth={3} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function Notifications() {
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    if (items) return;
    api
      .get<Paginated<Transaction>>("/transactions/", { status: "failed", page_size: 5 })
      .then((page) => setItems(page.results))
      .catch(() => setFailed(true));
  };

  return (
    <Popover
      className="w-80"
      trigger={({ toggle, open }) => (
        <button
          onClick={() => {
            load();
            toggle();
          }}
          aria-expanded={open}
          className={ICON_CHIP}
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-amber-400 ring-2 ring-surface" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
            <p className="text-sm font-semibold text-ink">Payment alerts</p>
            <Link to="/transactions?status=failed" onClick={close} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              View all
            </Link>
          </div>
          {failed && <p className="px-2.5 py-4 text-sm text-muted">Couldn't load alerts.</p>}
          {!failed && !items && <p className="px-2.5 py-4 text-sm text-muted">Loading…</p>}
          {items?.length === 0 && <p className="px-2.5 py-4 text-sm text-muted">No failed payments. All clear.</p>}
          <ul>
            {items?.map((txn) => (
              <li key={txn.id}>
                <Link
                  to={`/customers/${txn.customer.id}`}
                  onClick={close}
                  className="flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-3"
                >
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{txn.customer.company_name}</span>
                    <span className="block text-xs text-muted">
                      Payment of {formatCurrency(txn.amount)} failed · {relativeDay(txn.occurred_at.slice(0, 10))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/customers?search=${encodeURIComponent(term)}` : "/customers");
  };

  const onLogout = async () => {
    await logout();
    toast.success("Signed out", "See you next time.");
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] items-center gap-3 bg-canvas/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button onClick={onMenu} className={cn(ICON_CHIP, "lg:hidden")} aria-label="Open navigation">
        <Menu className="size-5" />
      </button>

      <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 sm:block" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customers by name or email…"
          aria-label="Search customers"
          className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm text-ink shadow-card placeholder:text-muted focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <AppearanceMenu />
        <Notifications />

        
        <Popover
          className="w-60"
          trigger={({ toggle, open }) => (
            <button onClick={toggle} aria-expanded={open} className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1 shadow-card hover:bg-surface-2">
              <Avatar name={user?.full_name ?? "User"} />
              <span className="hidden text-left md:block">
                <span className="block text-sm leading-tight font-semibold text-ink">{user?.full_name}</span>
                <span className="block text-xs leading-tight text-muted">{user?.job_title || user?.organization?.name}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted md:block" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
                <p className="truncate text-sm font-semibold text-ink">{user?.full_name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
              <div className="pt-1.5">
                <MenuItem icon={<UserRound className="size-4" />} onClick={() => { close(); navigate("/settings?tab=profile"); }}>
                  Your profile
                </MenuItem>
                <MenuItem icon={<Settings className="size-4" />} onClick={() => { close(); navigate("/settings"); }}>
                  Settings
                </MenuItem>
                <MenuItem icon={<LogOut className="size-4" />} danger onClick={() => { close(); onLogout(); }}>
                  Sign out
                </MenuItem>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}
