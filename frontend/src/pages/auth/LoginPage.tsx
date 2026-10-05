import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";

const DEMO = { email: "demo@flowmetrics.io", password: "FlowMetrics2026!" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  const submit = async (credentials: { email: string; password: string }) => {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(credentials.email)) next.email = "Enter a valid email address.";
    if (!credentials.password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await login(credentials.email, credentials.password);
      toast.success("Welcome back", "You're signed in to FlowMetrics.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const err = error as ApiError;
      setErrors({ email: err.field?.("email"), password: err.field?.("password"), form: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit({ email: email.trim(), password });
  };

  return (
    <AuthLayout
      title="Sign in to FlowMetrics"
      subtitle={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Create a workspace
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
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          leading={<Mail className="size-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          leading={<Lock className="size-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" loading={submitting} className="w-full justify-center">
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or explore with sample data <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        variant="secondary"
        className="w-full justify-center"
        icon={<Sparkles className="size-4 text-amber-500" />}
        disabled={submitting}
        onClick={() => {
          setEmail(DEMO.email);
          setPassword(DEMO.password);
          submit(DEMO);
        }}
      >
        Continue with the demo workspace
      </Button>
    </AuthLayout>
  );
}
