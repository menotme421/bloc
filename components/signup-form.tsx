"use client"
import { useState, useTransition, useActionState } from "react"
import { cn } from "@/lib/utils"
import {
  signUp,
  signIn,
  signInWithGoogle,
  type AuthState,
} from "@/app/(auth)/auth/actions";
import { Eye, EyeOff, CircleCheck, Circle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"

const initialAuthState: AuthState = { error: null, message: undefined };

function PasswordInputField({
  id,
  label,
  name,
  value,
  onChange,
  showPassword,
  onToggleShow,
  autoComplete,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleShow: () => void;
  autoComplete: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-lg leading-normal">
        {label}
      </FieldLabel>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="input-field input-field-card w-full pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted transition-colors hover:text-foreground"
        >
          {showPassword ? (
            <EyeOff className="size-5" />
          ) : (
            <Eye className="size-5" />
          )}
        </button>
      </div>
    </Field>
  );
}

function PasswordChecker({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    {
      label: "Contains a special symbol",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
  const confirmDirty = confirmPassword.length > 0;
  const matches = confirmDirty && confirmPassword === password;

  return (
    <div className="flex flex-col gap-1.5">
      {checks.map((check) => (
        <div
          key={check.label}
          className={cn(
            "flex items-center gap-1.5 text-sm",
            check.met ? "text-success" : "text-foreground-muted"
          )}
        >
          {check.met ? (
            <CircleCheck className="size-3.5 shrink-0" />
          ) : (
            <Circle className="size-3.5 shrink-0" />
          )}
          {check.label}
        </div>
      ))}
      {confirmDirty && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm",
            matches ? "text-success" : "text-destructive"
          )}
        >
          {matches ? (
            <CircleCheck className="size-3.5 shrink-0" />
          ) : (
            <X className="size-3.5 shrink-0" />
          )}
          {matches ? "Passwords match" : "Passwords do not match"}
        </div>
      )}
    </div>
  );
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  type Mode = "signin" | "signup";
  const [mode, setMode] = useState<Mode>("signup");
  const isSignUp = mode === "signup";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGooglePending, startGoogle] = useTransition();
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    isSignUp ? signUp : signIn,
    initialAuthState,
  )
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-md border border-border p-0 ring-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form action={formAction} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-card-title text-balance">
                  {isSignUp ? "Create your account" : "Welcome back"}
                </h1>
                <p className="text-body text-balance text-foreground-muted">
                  {isSignUp ? "Enter your email below to create your account" : "Enter your email below to sign in"} 
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="email" className="text-lg leading-normal">
                  Email
                </FieldLabel>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="example@example.com"
                  required
                  className="input-field input-field-card"
                />
                <FieldDescription>
                  We&apos;ll use this to contact you. We will not share your
                  email with anyone else.
                </FieldDescription>
              </Field>
              {isSignUp ? (
                <Field className="grid grid-cols-2 gap-4">
                  <PasswordInputField
                    id="password"
                    label="Password"
                    name="password"
                    value={password}
                    onChange={setPassword}
                    showPassword={showPassword}
                    onToggleShow={() => setShowPassword((s) => !s)}
                    autoComplete="new-password"
                  />
                  <PasswordInputField
                    id="confirm-password"
                    label="Confirm Password"
                    name="confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    showPassword={showConfirm}
                    onToggleShow={() => setShowConfirm((s) => !s)}
                    autoComplete="new-password"
                  />
                </Field>
              ) : (
                <PasswordInputField
                  id="password"
                  label="Password"
                  name="password"
                  value={password}
                  onChange={setPassword}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  autoComplete="current-password"
                />
              )}
              {isSignUp && (
                <PasswordChecker
                  password={password}
                  confirmPassword={confirmPassword}
                />
              )}
              <Field>
                {state?.error && (
                  <FieldDescription className="text-destructive">
                    {state.error}
                  </FieldDescription>
                )}
                {state?.message && (
                  <FieldDescription className="text-primary">
                    {state.message}
                  </FieldDescription>
                )}
                <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                  {isPending ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                </button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field>
                <button
                  type="button"
                  disabled={isGooglePending}
                  onClick={() => startGoogle(() => signInWithGoogle())}
                  className="btn btn-secondary w-full gap-2"
                >
                  <svg
                    className="size-4 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {isGooglePending ? "Redirecting..." : "Continue with Google"}
                </button>
              </Field>
              <FieldDescription className="text-center">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode(isSignUp ? "signin" : "signup")}
                  className="text-sm text-primary"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="relative hidden items-center justify-center bg-card p-8 md:flex">
            <img
              src="/image/signinup.svg"
              alt="Sign in illustration"
              className="h-auto w-full max-w-[320px]"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}