import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import type { Plan } from "@/types";

interface Values {
  name: string;
  description: string;
  monthly_price: string;
  annual_price: string;
  trial_days: string;
  features: string;
  is_active: boolean;
  is_featured: boolean;
}

type Errors = Partial<Record<keyof Values | "form", string>>;

const toValues = (plan?: Plan | null): Values => ({
  name: plan?.name ?? "",
  description: plan?.description ?? "",
  monthly_price: plan?.monthly_price ?? "",
  annual_price: plan?.annual_price ?? "",
  trial_days: String(plan?.trial_days ?? 14),
  features: plan?.features.join("\n") ?? "",
  is_active: plan?.is_active ?? true,
  is_featured: plan?.is_featured ?? false,
});

function validate(v: Values): Errors {
  const errors: Errors = {};
  const monthly = Number(v.monthly_price);
  const annual = Number(v.annual_price);
  const trial = Number(v.trial_days);
  if (v.name.trim().length < 2) errors.name = "Plan name must be at least 2 characters.";
  if (v.monthly_price === "" || Number.isNaN(monthly) || monthly < 0) errors.monthly_price = "Enter a valid monthly price.";
  if (v.annual_price === "" || Number.isNaN(annual) || annual < 0) errors.annual_price = "Enter a valid annual price.";
  else if (!errors.monthly_price && annual > monthly * 12) errors.annual_price = "Annual price shouldn't exceed 12× monthly.";
  if (!Number.isInteger(trial) || trial < 0 || trial > 90) errors.trial_days = "Use a whole number between 0 and 90.";
  return errors;
}

export function PlanFormModal({ open, onClose, plan, onSaved }: { open: boolean; onClose: () => void; plan?: Plan | null; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Values>(toValues(plan));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(toValues(plan));
      setErrors({});
    }
  }, [open, plan]);

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      monthly_price: Number(values.monthly_price).toFixed(2),
      annual_price: Number(values.annual_price).toFixed(2),
      trial_days: Number(values.trial_days),
      features: values.features.split("\n").map((f) => f.trim()).filter(Boolean),
      is_active: values.is_active,
      is_featured: values.is_featured,
    };
    try {
      if (plan) await api.patch(`/plans/${plan.id}/`, payload);
      else await api.post("/plans/", payload);
      toast.success(plan ? "Plan updated" : "Plan created", payload.name);
      onSaved();
      onClose();
    } catch (error) {
      const err = error as ApiError;
      const next: Errors = {};
      (Object.keys(values) as (keyof Values)[]).forEach((key) => {
        if (err.field?.(key)) next[key] = err.field(key);
      });
      if (!Object.keys(next).length) next.form = err.message;
      setErrors(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? `Edit ${plan.name}` : "Create a plan"}
      description="Pricing changes apply to new subscriptions only."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={saving}>
            {plan ? "Save plan" : "Create plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {errors.form && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 sm:col-span-2 dark:bg-red-500/10 dark:text-red-300">
            {errors.form}
          </p>
        )}
        <Input label="Plan name" value={values.name} onChange={set("name")} error={errors.name} />
        <Input label="Trial length (days)" type="number" min={0} max={90} value={values.trial_days} onChange={set("trial_days")} error={errors.trial_days} />
        <Input label="Monthly price" type="number" min={0} step="0.01" value={values.monthly_price} onChange={set("monthly_price")} error={errors.monthly_price} />
        <Input
          label="Annual price"
          type="number"
          min={0}
          step="0.01"
          value={values.annual_price}
          onChange={set("annual_price")}
          error={errors.annual_price}
          hint="Typically ~2 months free versus monthly."
        />
        <div className="sm:col-span-2">
          <Input label="Short description" value={values.description} onChange={set("description")} />
        </div>
        <div className="sm:col-span-2">
          <Textarea label="Features" hint="One feature per line (up to 12)." value={values.features} onChange={set("features")} />
        </div>
        <div className="divide-y divide-line rounded-xl border border-line px-4 sm:col-span-2">
          <Toggle checked={values.is_active} onChange={(is_active) => setValues((v) => ({ ...v, is_active }))} label="Available for new subscriptions" />
          <Toggle checked={values.is_featured} onChange={(is_featured) => setValues((v) => ({ ...v, is_featured }))} label="Highlight as most popular" />
        </div>
      </form>
    </Modal>
  );
}
