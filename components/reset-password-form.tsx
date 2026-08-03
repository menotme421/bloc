"use client"
import { useState, useActionState } from "react"
import { cn } from "@/lib/utils"
import { updatePassword } from "@/app/(auth)/auth/actions";
import type { AuthState } from "@/app/(auth)/auth/actions";
import { Eye, EyeOff, CircleCheck, Circle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

const initialAuthState: AuthState = { error: null, message: undefined };

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    updatePassword,
    initialAuthState,
  );

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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-md border border-border p-0 ring-0">
        <CardContent className="p-6 md:p-8">
          <form action={formAction} className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-card-title text-balance">
                Choose a new password
              </h1>
              <p className="text-body text-balance text-foreground-muted">
                Your new password must be different from previous passwords.
              </p>
            </div>
            <FieldGroup>
              <Field className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel
                    htmlFor="password"
                    className="text-lg leading-normal"
                  >
                    Password
                  </FieldLabel>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className="input-field input-field-card w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide Password" : "Show Password"}
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
                <Field>
                  <FieldLabel
                    htmlFor="confirm-password"
                    className="text-lg leading-normal"
                  >
                    Confirm Password
                  </FieldLabel>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      name="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className="input-field input-field-card w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      aria-label={showConfirm ? "Hide Password" : "Show Password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {showConfirm ? (
                        <EyeOff className="size-5" />
                      ) : (
                        <Eye className="size-5" />
                      )}
                    </button>
                  </div>
                </Field>
              </Field>
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
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isPending}
              >
                {isPending ? "Please wait..." : "Update Password"}
              </button>
              {state?.error && (
                <FieldDescription className="text-destructive">
                  {state.error}
                </FieldDescription>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}