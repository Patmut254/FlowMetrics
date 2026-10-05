import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, Building2, KeyRound, Monitor, Moon, Palette, Sun, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Controls";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_RANGE_KEY } from "@/context/DateRangeContext";
import { ACCENTS, useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, humanize } from "@/lib/format";
import type { AuthResponse, Organization, Preferences, ThemePreference, User } from "@/types";

type Tab = "profile" | "workspace" | "notifications" | "appearance" | "account";

const TABS: { value: Tab; label: string; icon: typeof UserRound }[] = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "workspace", label: "Workspace", icon: Building2 },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "account", label: "Account & security", icon: KeyRound },
];

const TIMEZONES = ["UTC", "Africa/Nairobi", "Africa/Lagos", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Singapore", "Australia/Sydney"];

function Section({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card>
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3.5 rounded-b-2xl">{footer}</div>}
    </Card>
  );
}

const fieldErrors = (err: ApiError, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, err.field?.(k)]).filter(([, v]) => v)) as Record<string, string>;

/* --------------------------------------------------------------- Profile */
function ProfileTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ first_name: "", last_name: "", job_title: "", phone: "", timezone: "UTC" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setValues({ first_name: user.first_name, last_name: user.last_name, job_title: user.job_title, phone: user.phone, timezone: user.timezone });
  }, [user]);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.first_name.trim()) next.first_name = "First name is required.";
    if (values.phone && !/^[+\d][\d\s()-]{5,}$/.test(values.phone)) next.phone = "Enter a valid phone number.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      setUser(await api.patch<User>("/auth/me/", values));
      toast.success("Profile saved");
    } catch (err) {
      setErrors(fieldErrors(err as ApiError, Object.keys(values)));
      toast.error("Couldn't save profile", (err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section
        title="Profile"
        description="How you appear to teammates in this workspace."
        footer={
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        }
      >
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={user?.full_name ?? "User"} size="lg" />
          <div>
            <p className="font-semibold text-ink">{user?.full_name}</p>
            <p className="text-sm text-muted">
              {user?.email} · {user?.role ? humanize(user.role) : ""}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={values.first_name} onChange={set("first_name")} error={errors.first_name} />
          <Input label="Last name" value={values.last_name} onChange={set("last_name")} error={errors.last_name} />
          <Input label="Job title" value={values.job_title} onChange={set("job_title")} placeholder="e.g. Head of Growth" />
          <Input label="Phone" value={values.phone} onChange={set("phone")} error={errors.phone} placeholder="+254 700 000 000" />
          <Input label="Email" value={user?.email ?? ""} disabled hint="Contact support to change your login email." />
          <Select label="Timezone" value={values.timezone} onChange={set("timezone")}>
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
        </div>
      </Section>
    </form>
  );
}

/* ------------------------------------------------------------- Workspace */
function WorkspaceTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === "owner" || user?.role === "admin";
  const org = user?.organization;
  const [values, setValues] = useState({ name: "", industry: "", website: "", currency: "USD", timezone: "UTC", fiscal_year_start: 1 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) setValues({ name: org.name, industry: org.industry, website: org.website, currency: org.currency, timezone: org.timezone, fiscal_year_start: org.fiscal_year_start });
  }, [org]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = "Workspace name must be at least 2 characters.";
    if (values.website && !/^https?:\/\/.+\..+/.test(values.website)) next.website = "Enter a full URL starting with https://";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const updated = await api.patch<Organization>("/auth/organization/", values);
      if (user) setUser({ ...user, organization: updated });
      toast.success("Workspace updated");
    } catch (err) {
      setErrors(fieldErrors(err as ApiError, Object.keys(values)));
      toast.error("Couldn't update workspace", (err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }));

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section
        title="Workspace"
        description={canEdit ? "Settings shared by everyone in your organization." : "Only owners and admins can change workspace settings."}
        footer={
          canEdit && (
            <Button type="submit" loading={saving}>
              Save workspace
            </Button>
          )
        }
      >
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <Input label="Workspace name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} error={errors.name} />
          <Input label="Industry" value={values.industry} onChange={(e) => setValues((v) => ({ ...v, industry: e.target.value }))} />
          <Input label="Website" value={values.website} onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} error={errors.website} placeholder="https://" />
          <Select label="Reporting currency" value={values.currency} onChange={(e) => setValues((v) => ({ ...v, currency: e.target.value }))} hint="Used to display all monetary values.">
            <option value="USD">US Dollar (USD)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="GBP">British Pound (GBP)</option>
          </Select>
          <Select label="Timezone" value={values.timezone} onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}>
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
          <Select
            label="Fiscal year starts in"
            value={values.fiscal_year_start}
            onChange={(e) => setValues((v) => ({ ...v, fiscal_year_start: Number(e.target.value) }))}
          >
            {months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </fieldset>
        {org && (
          <dl className="mt-6 grid gap-3 rounded-xl bg-surface-2 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">Workspace ID</dt>
              <dd className="font-mono text-ink">{org.slug}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Members</dt>
              <dd className="font-semibold text-ink">{org.member_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Created</dt>
              <dd className="font-semibold text-ink">{formatDate(org.created_at)}</dd>
            </div>
          </dl>
        )}
      </Section>
    </form>
  );
}

/* ---------------------------------------------- Notifications & appearance */
function usePreferences() {
  const toast = useToast();
  const state = useApi<Preferences>((signal) => api.get("/auth/me/preferences/", undefined, signal), []);
  const update = async (patch: Partial<Preferences>) => {
    const previous = state.data;
    state.setData((current) => (current ? { ...current, ...patch } : current));
    try {
      state.setData(await api.patch<Preferences>("/auth/me/preferences/", patch));
      return true;
    } catch (err) {
      state.setData(previous);
      toast.error("Couldn't save preference", (err as ApiError).message);
      return false;
    }
  };
  return { ...state, update };
}

function NotificationsTab() {
  const toast = useToast();
  const { data, error, refetch, update } = usePreferences();
  const items: { key: keyof Preferences; label: string; description: string }[] = [
    { key: "notify_weekly_digest", label: "Weekly performance digest", description: "A Monday email summarising MRR, churn and new customers." },
    { key: "notify_payment_failed", label: "Failed payments", description: "Get alerted when a customer's payment fails." },
    { key: "notify_churn_alert", label: "Churn alerts", description: "Know immediately when a paying customer cancels." },
    { key: "notify_new_customer", label: "New customers", description: "A notification for every new sign-up." },
    { key: "notify_product_updates", label: "Product updates", description: "News about new FlowMetrics features." },
  ];

  return (
    <Section title="Notifications" description="Choose which events you want to hear about. Changes save automatically.">
      {error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : !data ? (
        <div className="space-y-4">
          {items.map((i) => (
            <Skeleton key={i.key} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => (
            <Toggle
              key={item.key}
              label={item.label}
              description={item.description}
              checked={Boolean(data[item.key])}
              onChange={async (checked) => {
                if (await update({ [item.key]: checked })) toast.success("Preference saved", `${item.label} ${checked ? "on" : "off"}.`);
              }}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function AppearanceTab() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const toast = useToast();
  const { data, update } = usePreferences();

  const chooseTheme = async (next: ThemePreference) => {
    setTheme(next);
    await update({ theme: next });
  };

  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <Section title="Appearance" description="Personalise how FlowMetrics looks on this device and account.">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">Theme</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors",
                theme === value ? "border-brand-500 ring-1 ring-brand-500" : "border-line hover:bg-surface-2",
              )}
            >
              <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => chooseTheme(value)} className="sr-only" />
              <div
                className={cn(
                  "mb-3 flex h-20 gap-1.5 overflow-hidden rounded-lg border border-line p-2",
                  value === "dark" ? "bg-[#14161a]" : value === "light" ? "bg-[#f6f7f9]" : "bg-gradient-to-r from-[#f6f7f9] from-50% to-[#14161a] to-50%",
                )}
                aria-hidden
              >
                <div className={cn("w-1/4 rounded", value === "dark" ? "bg-white/10" : "bg-white")} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded bg-brand-500/80" />
                  <div className={cn("h-8 rounded", value === "dark" ? "bg-white/10" : "bg-white")} />
                </div>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon className="size-4 text-muted" aria-hidden /> {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-1 text-sm font-medium text-ink">Accent colour</legend>
        <p className="mb-3 text-sm text-muted">Used for buttons, navigation, highlights and the main chart series. Saved on this device.</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-sm font-semibold transition-colors",
                accent === option.value ? "border-brand-500 bg-brand-50 text-ink dark:bg-brand-500/10" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="accent"
                value={option.value}
                checked={accent === option.value}
                onChange={() => setAccent(option.value)}
                className="sr-only"
              />
              <span className="size-5 rounded-full" style={{ background: option.swatch }} aria-hidden />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 divide-y divide-line border-t border-line">
        <Toggle
          label="Compact tables"
          description="Reduce row height to fit more data on screen."
          checked={Boolean(data?.compact_tables)}
          disabled={!data}
          onChange={async (compact_tables) => {
            document.documentElement.dataset.density = compact_tables ? "compact" : "comfortable";
            if (await update({ compact_tables })) toast.success("Preference saved");
          }}
        />
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Default date range</p>
            <p className="text-sm text-muted">Used when you open the dashboard and analytics.</p>
          </div>
          <Select
            aria-label="Default date range"
            wrapperClassName="sm:w-48"
            value={data?.default_date_range ?? "30d"}
            disabled={!data}
            onChange={async (e) => {
              const value = e.target.value as Preferences["default_date_range"];
              try {
                localStorage.setItem(DEFAULT_RANGE_KEY, value);
              } catch {
                /* ignore */
              }
              if (await update({ default_date_range: value })) toast.success("Default range saved", "Applies next time you open FlowMetrics.");
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </Select>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- Account */
function AccountTab() {
  const { setSession, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!pw.current_password) next.current_password = "Enter your current password.";
    if (pw.new_password.length < 8) next.new_password = "Use at least 8 characters.";
    if (pw.confirm !== pw.new_password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      setSession(await api.post<AuthResponse>("/auth/me/password/", { current_password: pw.current_password, new_password: pw.new_password }));
      setPw({ current_password: "", new_password: "", confirm: "" });
      toast.success("Password updated", "Other sessions have been signed out.");
    } catch (err) {
      setErrors(fieldErrors(err as ApiError, ["current_password", "new_password"]));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await api.delete("/auth/me/", { password: deletePassword });
      await logout();
      toast.success("Account deleted");
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteError((err as ApiError).field?.("password") ?? (err as ApiError).message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onChangePassword} noValidate>
        <Section
          title="Change password"
          description="Use a long, unique password. Changing it signs out your other sessions."
          footer={
            <Button type="submit" loading={saving}>
              Update password
            </Button>
          }
        >
          <div className="grid max-w-md gap-4">
            <Input label="Current password" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} error={errors.current_password} />
            <Input label="New password" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} error={errors.new_password} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} error={errors.confirm} />
          </div>
        </Section>
      </form>

      <Card className="border-red-200 dark:border-red-500/30">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Delete account</h2>
            <p className="mt-0.5 text-sm text-muted">Permanently remove your account. If you're the only member, the workspace and its data are deleted too.</p>
          </div>
          <Button variant="danger" onClick={() => { setDeletePassword(""); setDeleteError(undefined); setDeleteOpen(true); }}>
            Delete account
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Delete your account?"
        description="This can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} disabled={!deletePassword} onClick={onDelete}>
              Delete forever
            </Button>
          </>
        }
      >
        <Input label="Confirm with your password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} error={deleteError} />
      </Modal>
    </div>
  );
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "profile") as Tab;

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, workspace and preferences." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setParams({ tab: value }, { replace: true })}
              aria-current={tab === value ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                tab === value ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
              )}
            >
              <Icon className={cn("size-4", tab === value ? "text-brand-600 dark:text-brand-300" : "text-muted")} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 max-w-3xl">
          {tab === "profile" && <ProfileTab />}
          {tab === "workspace" && <WorkspaceTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "account" && <AccountTab />}
        </div>
      </div>
    </div>
  );
}
