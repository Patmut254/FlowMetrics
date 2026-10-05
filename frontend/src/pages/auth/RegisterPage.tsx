import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useAuth, type RegisterPayload } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";

type Errors = Partial<Record<keyof RegisterPayload | "form", string>>;

const EMPTY: RegisterPayload = { first_name: "", last_name: "", email: "", password: "", organization_name: "" };

function validate(values: RegisterPayload): Errors {
  const errors: Errors = {};
  if (!values.first_name.trim()) errors.first_name = "First name is required.";
  if (!values.last_name.trim()) errors.last_name = "Last name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (values.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (/^\d+$/.test(values.password)) errors.password = "Password can't be entirely numeric.";
  if (values.organization_name.trim().length < 2) errors.organization_name = "Workspace name must be at least 2 characters.";
  return errors;
}

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState<RegisterPayload>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof RegisterPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await register({ ...values, email: values.email.trim() });
      toast.success("Workspace created", `Welcome to FlowMetrics, ${values.first_name}.`);
      navigate("/", { replace: true });
    } catch (error) {
      const err = error as ApiError;
      setErrors({
        first_name: err.field?.("first_name"),
        last_name: err.field?.("last_name"),
        email: err.field?.("email"),
        password: err.field?.("password"),
        organization_name: err.field?.("organization_name"),
        form: Object.keys(err.errors ?? {}).length ? undefined : err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const score = strength(values.password);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.form && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {errors.form}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" autoComplete="given-name" value={values.first_name} onChange={set("first_name")} error={errors.first_name} />
          <Input label="Last name" autoComplete="family-name" value={values.last_name} onChange={set("last_name")} error={errors.last_name} />
        </div>
        <Input label="Work email" type="email" autoComplete="email" placeholder="you@company.com" value={values.email} onChange={set("email")} error={errors.email} />
        <Input
          label="Workspace name"
          placeholder="e.g. Acme Analytics"
          hint="Usually your company name. You can change it later."
          value={values.organization_name}
          onChange={set("organization_name")}
          error={errors.organization_name}
        />
        <div>
          <Input label="Password" type="password" autoComplete="new-password" value={values.password} onChange={set("password")} error={errors.password} />
          {values.password && !errors.password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < score ? (score >= 3 ? "bg-emerald-500" : "bg-amber-400") : "bg-surface-3"}`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-muted">{labels[score]}</span>
            </div>
          )}
        </div>
        <Button type="submit" loading={submitting} className="w-full justify-center">
          Create workspace
        </Button>
        <p className="text-center text-xs text-muted">Your workspace starts empty — add customers and plans to see live metrics.</p>
      </form>
    </AuthLayout>
  );
}
