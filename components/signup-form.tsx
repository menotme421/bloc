"use client"
import { useState, useTransition, useActionState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  signUp,
  signIn,
  resetPassword,
  signInWithGoogle,
  type AuthState,
} from "@/app/(auth)/auth/actions";
import { Eye, EyeOff, CircleCheck, Circle, X, MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"

const initialAuthState: AuthState = { error: null, message: undefined };

type Mode = "signin" | "signup" | "forgot";

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
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
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
            check.met ? "text-success" : "text-muted-foreground"
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

function EmailConfirmationView({
  mode,
  email,
  onBackToSignIn,
}: {
  mode: "signup" | "forgot";
  email?: string;
  onBackToSignIn: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center md:p-8">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <MailCheck className="size-7 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-balance">Check your email</h1>
      {mode === "signup" ? (
        <p className="text-lg text-balance text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click
          it to activate your account — you&apos;ll go straight to the app.
        </p>
      ) : (
        <p className="text-lg text-balance text-muted-foreground">
          We sent a password reset link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click
          it to choose a new password.
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onBackToSignIn}
      >
        Back to sign in
      </Button>
    </div>
  );
}

function ModeForm({
  mode,
  onSwitchMode,
  initialError,
  initialSuccess,
}: {
  mode: Mode;
  onSwitchMode: (next: Mode) => void;
  initialError?: string;
  initialSuccess?: string;
}) {
  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";

  const action =
    mode === "signup" ? signUp : mode === "forgot" ? resetPassword : signIn;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGooglePending, startGoogle] = useTransition();
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    action,
    initialAuthState,
  );
  const [dismissed, setDismissed] = useState(false);
  const [dismissSuccess, setDismissSuccess] = useState(false);

  const showConfirmation = !!state?.message && !state?.error;
  const showError = !!state?.error;
  const banner = initialError && !dismissed ? initialError : null;
  const successBanner =
    initialSuccess && !dismissSuccess ? initialSuccess : null;

  if (showConfirmation) {
    return (
      <EmailConfirmationView
        mode={isForgot ? "forgot" : "signup"}
        email={state.email}
        onBackToSignIn={() => onSwitchMode("signin")}
      />
    );
  }

  return (
    <form action={formAction} className="p-6 md:p-8">
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            {isForgot
              ? "Reset your password"
              : isSignUp
                ? "Create your account"
                : "Welcome back"}
          </h1>
          <p className="text-lg text-balance text-muted-foreground">
            {isForgot
              ? "Enter your email below and we'll send you a reset link"
              : isSignUp
                ? "Enter your email below to create your account"
                : "Enter your email below to sign in"}
          </p>
        </div>
        {successBanner && (
          <FieldDescription className="rounded-md border border-success/30 bg-success/5 p-3 text-success">
            <span className="flex items-center justify-between gap-2 text-left">
              {successBanner}
              <button
                type="button"
                onClick={() => setDismissSuccess(true)}
                aria-label="Dismiss"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </span>
          </FieldDescription>
        )}
        {banner && (
          <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <span className="flex items-center justify-between gap-2 text-left">
              {banner}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </span>
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="email" className="text-lg leading-normal">
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@example.com"
            required
          />
          {!isForgot && (
            <FieldDescription>
              We&apos;ll use this to contact you. We will not share your
              email with anyone else.
            </FieldDescription>
          )}
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
        ) : isForgot ? null : (
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
          {showError && state.error && (
            <FieldDescription className="text-destructive">
              {state.error}
              {state.errorType === "invalid_credentials" && (
                <button
                  type="button"
                  onClick={() => onSwitchMode("forgot")}
                  className="mt-1 block text-sm text-primary underline underline-offset-4"
                >
                  Forget password? Reset here
                </button>
              )}
            </FieldDescription>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending
              ? "Please wait..."
              : isForgot
                ? "Send reset link"
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
          </Button>
        </Field>
        {!isForgot && (
          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            Or continue with
          </FieldSeparator>
        )}
        {!isForgot && (
          <Field>
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              disabled={isGooglePending}
              onClick={() => startGoogle(() => signInWithGoogle())}
            >
              <svg
                className="size-4 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.467 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              {isGooglePending
                ? "Redirecting..."
                : "Continue with Google"}
            </Button>
          </Field>
        )}
        <div className="text-center text-sm leading-normal font-normal text-muted-foreground">
          {isForgot ? (
            <>
              Remembered it?{" "}
              <button
                type="button"
                onClick={() => onSwitchMode("signin")}
                className="relative z-10 inline-flex min-h-[44px] items-center px-1 text-sm font-medium text-primary underline-offset-4 hover:underline touch-auto select-auto cursor-pointer"
                style={{ WebkitUserSelect: "auto", userSelect: "auto", touchAction: "auto" } as React.CSSProperties}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => onSwitchMode(isSignUp ? "signin" : "signup")}
                className="relative z-10 inline-flex min-h-[44px] items-center px-1 text-sm font-medium text-primary underline-offset-4 hover:underline touch-auto select-auto cursor-pointer"
                style={{ WebkitUserSelect: "auto", userSelect: "auto", touchAction: "auto" } as React.CSSProperties}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}

export function SignupForm({
  initialMode = "signup",
  errorMessage,
  successMessage,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  initialMode?: "signin" | "signup";
  errorMessage?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);

  // Keep URL in sync so /auth?mode=signin deep-links work and refresh doesn't revert to signup
  // and so "Sign in → sign up" toggle doesn't appear stuck
  const syncModeToUrl = (next: Mode) => {
    setMode(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "signup") {
      params.delete("mode");
    } else {
      params.set("mode", next);
    }
    const qs = params.toString();
    router.replace(`/auth${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  // If user lands via direct /auth?mode=signin link (e.g. Navbar Sign in), respect it even after client toggle stale
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "signin" || urlMode === "signup") {
      if (urlMode !== mode && mode !== "forgot") {
        // only auto-sync if not in forgot flow to avoid fighting user
        setMode(urlMode as Mode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-md border border-border p-0 ring-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <ModeForm
            key={mode}
            mode={mode}
            onSwitchMode={syncModeToUrl}
            initialError={errorMessage}
            initialSuccess={successMessage}
          />
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
