import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented, Toggle } from "@/components/ui/Controls";
import { Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { usePlans } from "@/hooks/usePlans";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { BillingCycle, Subscription } from "@/types";

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
  /** When provided, the modal changes this subscription's plan instead of starting a new one. */
  current?: Subscription | null;
  onDone: () => void;
}

export function PlanModal({ open, onClose, customerId, current, onDone }: PlanModalProps) {
  const toast = useToast();
  const plans = usePlans();
  const activePlans = (plans.data ?? []).filter((p) => p.is_active);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [withTrial, setWithTrial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCycle(current?.billing_cycle ?? "monthly");
    setPlanId(current ? String(current.plan.id) : "");
  }, [open, current]);

  useEffect(() => {
    if (open && !planId && activePlans.length) setPlanId(String(activePlans[0].id));
  }, [open, planId, activePlans]);

  const selected = activePlans.find((p) => String(p.id) === planId);
  const price = selected ? (cycle === "annual" ? selected.annual_price : selected.monthly_price) : null;

  const submit = async () => {
    if (!planId) return setError("Choose a plan.");
    setSaving(true);
    setError(null);
    try {
      if (current) {
        await api.post(`/subscriptions/${current.id}/change-plan/`, { plan_id: Number(planId), billing_cycle: cycle });
        toast.success("Plan changed", `Now on ${selected?.name} (${cycle}).`);
      } else {
        await api.post("/subscriptions/", { customer_id: customerId, plan_id: Number(planId), billing_cycle: cycle, with_trial: withTrial });
        toast.success(withTrial ? "Trial started" : "Subscription started", selected?.name);
      }
      onDone();
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.field?.("plan_id") ?? apiError.field?.("customer_id") ?? apiError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current ? "Change plan" : "Start a subscription"}
      description={current ? `Currently on ${current.plan.name} · ${current.billing_cycle}` : "Choose a plan and billing cycle for this customer."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!activePlans.length}>
            {current ? "Change plan" : withTrial ? "Start trial" : "Start subscription"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        {plans.data && !activePlans.length ? (
          <p className="text-sm text-muted">Create a plan on the Subscriptions page first.</p>
        ) : (
          <Select label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {activePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {formatCurrency(plan.monthly_price, { cents: false })}/mo
              </option>
            ))}
          </Select>
        )}
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Billing cycle</p>
          <Segmented
            label="Billing cycle"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Annual" },
            ]}
          />
        </div>
        {!current && (
          <div className="rounded-xl border border-line px-4">
            <Toggle
              checked={withTrial}
              onChange={setWithTrial}
              label={`Start with a ${selected?.trial_days ?? 14}-day free trial`}
              description="No payment is taken until the trial ends."
            />
          </div>
        )}
        {price && (
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-ink-2">{cycle === "annual" ? "Billed yearly" : "Billed monthly"}</span>
            <span className="font-bold text-ink tabular">
              {formatCurrency(price)}
              <span className="font-medium text-muted">/{cycle === "annual" ? "yr" : "mo"}</span>
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

const REASONS = ["Too expensive", "Switched to a competitor", "Missing features", "No longer needed", "Budget cuts", "Other"];

export function CancelModal({ open, onClose, subscription, onDone }: { open: boolean; onClose: () => void; subscription: Subscription | null; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!subscription) return;
    setSaving(true);
    try {
      await api.post(`/subscriptions/${subscription.id}/cancel/`, { reason });
      toast.success("Subscription cancelled", `${subscription.customer.company_name} · ${subscription.plan.name}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error("Couldn't cancel subscription", (err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Cancel subscription?"
      description="Service ends today and the customer will count towards churn."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep subscription
          </Button>
          <Button variant="danger" onClick={submit} loading={saving}>
            Cancel subscription
          </Button>
        </>
      }
    >
      <Select label="Cancellation reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
    </Modal>
  );
}
