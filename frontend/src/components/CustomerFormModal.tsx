import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import { toISO } from "@/lib/dates";
import type { Channel, Customer, CustomerDetail } from "@/types";

export const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: "organic", label: "Organic search" },
  { value: "paid", label: "Paid ads" },
  { value: "referral", label: "Referral" },
  { value: "partner", label: "Partner" },
  { value: "outbound", label: "Outbound sales" },
];

export const SIZE_OPTIONS = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-1000", label: "201–1,000 employees" },
  { value: "1000+", label: "1,000+ employees" },
];

interface FormValues {
  company_name: string;
  contact_name: string;
  email: string;
  country: string;
  industry: string;
  company_size: string;
  channel: Channel;
  joined_at: string;
  notes: string;
}

type Errors = Partial<Record<keyof FormValues | "form", string>>;

function initialValues(customer?: CustomerDetail | null): FormValues {
  return {
    company_name: customer?.company_name ?? "",
    contact_name: customer?.contact_name ?? "",
    email: customer?.email ?? "",
    country: customer?.country ?? "",
    industry: customer?.industry ?? "",
    company_size: customer?.company_size ?? "11-50",
    channel: customer?.channel ?? "organic",
    joined_at: customer?.joined_at ?? toISO(new Date()),
    notes: customer?.notes ?? "",
  };
}

function validate(values: FormValues): Errors {
  const errors: Errors = {};
  if (values.company_name.trim().length < 2) errors.company_name = "Company name must be at least 2 characters.";
  if (!values.contact_name.trim()) errors.contact_name = "Contact name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.country.trim()) errors.country = "Country is required.";
  if (!values.joined_at) errors.joined_at = "Choose a join date.";
  else if (values.joined_at > toISO(new Date())) errors.joined_at = "Join date can't be in the future.";
  return errors;
}

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  customer?: CustomerDetail | null;
  onSaved: (customer: Customer) => void;
}

export function CustomerFormModal({ open, onClose, customer, onSaved }: CustomerFormModalProps) {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(() => initialValues(customer));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(customer);

  useEffect(() => {
    if (open) {
      setValues(initialValues(customer));
      setErrors({});
    }
  }, [open, customer]);

  const set = <K extends keyof FormValues>(key: K) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const payload = { ...values, email: values.email.trim(), company_name: values.company_name.trim() };
      const saved = editing
        ? await api.patch<Customer>(`/customers/${customer!.id}/`, payload)
        : await api.post<Customer>("/customers/", payload);
      toast.success(editing ? "Customer updated" : "Customer added", values.company_name);
      onSaved(saved);
      onClose();
    } catch (error) {
      const err = error as ApiError;
      const fieldErrors: Errors = {};
      (Object.keys(values) as (keyof FormValues)[]).forEach((key) => {
        if (err.field?.(key)) fieldErrors[key] = err.field(key);
      });
      if (!Object.keys(fieldErrors).length) fieldErrors.form = err.message;
      setErrors(fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit customer" : "Add customer"}
      description={editing ? "Update this customer's company details." : "Add a company to start tracking its subscriptions and revenue."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {editing ? "Save changes" : "Add customer"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {errors.form && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 sm:col-span-2 dark:bg-red-500/10 dark:text-red-300">
            {errors.form}
          </p>
        )}
        <Input label="Company name" value={values.company_name} onChange={set("company_name")} error={errors.company_name} />
        <Input label="Primary contact" value={values.contact_name} onChange={set("contact_name")} error={errors.contact_name} />
        <Input label="Billing email" type="email" value={values.email} onChange={set("email")} error={errors.email} />
        <Input label="Country" value={values.country} onChange={set("country")} error={errors.country} placeholder="e.g. Kenya" />
        <Input label="Industry" value={values.industry} onChange={set("industry")} placeholder="e.g. Fintech" />
        <Select label="Company size" value={values.company_size} onChange={set("company_size")}>
          {SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Acquisition channel" value={values.channel} onChange={set("channel")}>
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input label="Joined on" type="date" max={toISO(new Date())} value={values.joined_at} onChange={set("joined_at")} error={errors.joined_at} />
        <div className="sm:col-span-2">
          <Textarea label="Notes" value={values.notes} onChange={set("notes")} placeholder="Internal notes about this account (optional)" />
        </div>
      </form>
    </Modal>
  );
}
