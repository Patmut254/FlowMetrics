// ---- Accounts --------------------------------------------------------------
export type Role = "owner" | "admin" | "member";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  industry: string;
  website: string;
  currency: "USD" | "EUR" | "GBP";
  timezone: string;
  fiscal_year_start: number;
  member_count: number;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title: string;
  phone: string;
  timezone: string;
  role: Role | null;
  organization: Organization | null;
  date_joined: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type ThemePreference = "light" | "dark" | "system";
export type RangePreset = "7d" | "30d" | "90d" | "12m";

export interface Preferences {
  theme: ThemePreference;
  compact_tables: boolean;
  default_date_range: RangePreset;
  notify_weekly_digest: boolean;
  notify_payment_failed: boolean;
  notify_new_customer: boolean;
  notify_churn_alert: boolean;
  notify_product_updates: boolean;
}

// ---- Billing ---------------------------------------------------------------
export type CustomerStatus = "active" | "trialing" | "past_due" | "churned";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled";
export type TransactionStatus = "paid" | "pending" | "failed" | "refunded";
export type BillingCycle = "monthly" | "annual";
export type Channel = "organic" | "paid" | "referral" | "partner" | "outbound";

export interface Paginated<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string;
  monthly_price: string;
  annual_price: string;
  features: string[];
  trial_days: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  cancelled_subscriptions: number;
  mrr: string;
}

export interface CustomerRef {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
}

export interface Customer extends CustomerRef {
  country: string;
  industry: string;
  company_size: string;
  channel: Channel;
  status: CustomerStatus;
  joined_at: string;
  churned_at: string | null;
  current_plan: string | null;
  mrr: string;
  lifetime_revenue: string;
}

export interface Subscription {
  id: number;
  customer: CustomerRef;
  plan: { id: number; name: string; slug: string };
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  price: string;
  mrr: string;
  started_at: string;
  trial_ends_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  current_period_end: string | null;
  cancel_reason: string;
  previous: number | null;
}

export interface CustomerDetail extends Customer {
  notes: string;
  subscriptions: Subscription[];
  revenue_history: { month: string; revenue: string }[];
  payment_stats: { paid: number; failed: number };
}

export interface Transaction {
  id: number;
  reference: string;
  customer: CustomerRef;
  plan: string | null;
  billing_cycle: BillingCycle | null;
  amount: string;
  currency: string;
  status: TransactionStatus;
  method: "card" | "bank_transfer" | "paypal";
  description: string;
  occurred_at: string;
}

export interface TransactionSummary {
  paid: { count: number; amount: string };
  pending: { count: number; amount: string };
  failed: { count: number; amount: string };
  refunded: { count: number; amount: string };
  total_count: number;
  success_rate: number;
}

export interface SubscriptionStats {
  active: number;
  past_due: number;
  trialing: number;
  cancelled: number;
  monthly: number;
  annual: number;
  mrr: string;
  monthly_mrr: string;
  annual_mrr: string;
  trials_ended_30d: number;
  trials_converted_30d: number;
  cancelled_30d: number;
  trial_conversion_rate: number;
  average_mrr: string;
}

// ---- Analytics -------------------------------------------------------------
export interface Kpi {
  value: number;
  previous: number;
  change: number | null;
}

export type KpiKey =
  | "total_revenue"
  | "mrr"
  | "arr"
  | "active_customers"
  | "new_customers"
  | "churned_customers"
  | "churn_rate"
  | "conversion_rate"
  | "arpu"
  | "trialing";

export type Kpis = Record<KpiKey, Kpi> & {
  revenue_growth: number | null;
  customer_growth: number | null;
};

export type Granularity = "day" | "week" | "month";

export interface SeriesPoint {
  date: string;
  period_end: string;
  revenue: number;
  mrr: number;
  active_customers: number;
  new_customers: number;
  churned_customers: number;
  churn_rate: number;
  trials_started: number;
  trials_converted: number;
  new_mrr: number;
  expansion_mrr: number;
  contraction_mrr: number;
  churned_mrr: number;
  net_new_mrr: number;
}

export interface Series {
  granularity: Granularity;
  points: SeriesPoint[];
}

export interface PlanBreakdown {
  plan_id: number;
  plan: string;
  slug: string;
  mrr: number;
  subscriptions: number;
  monthly: number;
  annual: number;
  share: number;
}

export interface PlanPerformance {
  plan_id: number;
  plan: string;
  slug: string;
  monthly_price: number;
  subscribers: number;
  previous_subscribers: number;
  subscriber_change: number | null;
  mrr: number;
  arpa: number;
  revenue: number;
  new_subscriptions: number;
  churned_subscriptions: number;
  churn_rate: number;
  trial_conversion: number;
}

export type ActivityType =
  | "trial_started"
  | "converted"
  | "subscribed"
  | "upgraded"
  | "downgraded"
  | "cancelled"
  | "trial_expired"
  | "payment_failed";

export interface ActivityEvent {
  date: string;
  type: ActivityType;
  customer_id: number;
  customer: string;
  description: string;
  amount: number;
}

export interface DashboardData {
  range: { start: string; end: string };
  previous_range: { start: string; end: string };
  kpis: Kpis;
  series: Series;
  plan_breakdown: PlanBreakdown[];
  top_plans: PlanPerformance[];
  recent_transactions: Transaction[];
  activity: ActivityEvent[];
}

export interface AnalyticsData {
  range: { start: string; end: string };
  kpis: Kpis;
  health: {
    start_mrr: number;
    end_mrr: number;
    mrr_growth: number | null;
    net_revenue_retention: number | null;
    quick_ratio: number | null;
    monthly_churn: number;
    ltv: number | null;
    movements: { new: number; expansion: number; contraction: number; churned: number; net_new: number };
  };
  series: Series;
  acquisition: { channel: Channel; label: string; customers: number; converted: number; conversion_rate: number }[];
  funnel: { stage: string; count: number; rate: number }[];
  retention: { cohort: string; size: number; retention: (number | null)[] }[];
  plan_performance: PlanPerformance[];
}

// ---- Reports ---------------------------------------------------------------
export type ReportType = "executive" | "revenue" | "customers" | "subscriptions";
export type ValueFormat = "currency" | "number" | "percent" | "text" | "month" | "status";

export interface ReportSummaryItem {
  label: string;
  value: number | null;
  format: ValueFormat;
  change: number | null;
}

export interface ReportTable {
  title: string;
  columns: { key: string; label: string; format: ValueFormat }[];
  rows: Record<string, string | number | null>[];
}

export interface ReportData {
  summary: ReportSummaryItem[];
  chart: {
    type: "area" | "bar";
    title: string;
    granularity: Granularity;
    series: { key: string; label: string; format: ValueFormat }[];
    data: Record<string, string | number>[];
  };
  tables: ReportTable[];
}

export interface Report {
  id: number;
  name: string;
  report_type: ReportType;
  report_type_label: string;
  period_start: string;
  period_end: string;
  created_by: string | null;
  created_at: string;
  data?: ReportData;
}
