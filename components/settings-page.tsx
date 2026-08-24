"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTheme } from "next-themes";
import { Loader2, Monitor, Moon, Sun, Trash2, TriangleAlert, GlobeIcon, ChevronDownIcon, CheckIcon, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import {
  updateDisplayName,
  deleteAccount,
  type SettingsState,
} from "@/app/app/settings/actions";
import { signOut } from "@/app/(auth)/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const initialSettingsState: SettingsState = { error: null, message: undefined };

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function ProfileCard({ name, email }: { name: string; email: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initialSettingsState
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.profile.title")}</CardTitle>
        <CardDescription>{t("settings.profile.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="display-name">{t("settings.profile.displayName")}</FieldLabel>
              <Input
                id="display-name"
                name="display-name"
                type="text"
                defaultValue={name}
                maxLength={50}
                autoComplete="name"
                aria-invalid={Boolean(state.error)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">{t("settings.profile.email")}</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                readOnly
                className="cursor-not-allowed opacity-70"
              />
              <FieldDescription>{t("settings.profile.emailNoChange")}</FieldDescription>
            </Field>
          </FieldGroup>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state.message && !state.error && (
            <p className="text-sm text-success" role="status">
              {state.message}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("settings.profile.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const themeLabels: Record<string, string> = {
    light: t("settings.appearance.light"),
    dark: t("settings.appearance.dark"),
    system: t("settings.appearance.system"),
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance.title")}</CardTitle>
        <CardDescription>{t("settings.appearance.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-xs grid-cols-3 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                theme === value
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {themeLabels[value] ?? label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("settings.appearance.systemDesc")}</p>
      </CardContent>
    </Card>
  );
}

function LanguageCard() {
  const { locale, setLocale, t } = useI18n();

  const LANGUAGE_OPTIONS = [
    { value: "en" as const, label: t("settings.language.english") },
    { value: "ms" as const, label: t("settings.language.malay") },
    { value: "zh-CN" as const, label: t("settings.language.zhCN") },
    { value: "zh-TW" as const, label: t("settings.language.zhTW") },
  ];

  const activeLabel = LANGUAGE_OPTIONS.find((o) => o.value === locale)?.label ?? LANGUAGE_OPTIONS[0].label;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GlobeIcon className="size-4" />
          {t("settings.language.title")}
        </CardTitle>
        <CardDescription>{t("settings.language.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="language-select">{t("settings.language.title")}</FieldLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id="language-select"
                variant="outline"
                className="w-full max-w-full md:max-w-xs justify-between font-normal"
              >
                <span className="flex items-center gap-2">
                  <GlobeIcon className="size-4 text-muted-foreground" />
                  {activeLabel}
                </span>
                <ChevronDownIcon className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-48 max-w-[calc(100vw-2rem)]">
              {LANGUAGE_OPTIONS.map(({ value, label }) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => setLocale(value)}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{label}</span>
                  {locale === value && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <FieldDescription className="sr-only">{t("settings.language.desc")}</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}

function SignOutCard() {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogOut className="size-4" />
          {t("settings.signOut.title")}
        </CardTitle>
        <CardDescription>{t("settings.signOut.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full justify-center gap-2">
            <LogOut className="size-4" />
            {t("settings.signOut.button")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DangerCard({ email }: { email: string }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialSettingsState
  );

  const confirmed = confirm === email;

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">{t("settings.danger.title")}</CardTitle>
        <CardDescription>{t("settings.danger.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 />
          {t("settings.danger.deleteAccount")}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <TriangleAlert className="size-5" />
                {t("settings.danger.deleteAccountTitle")}
              </DialogTitle>
              <DialogDescription>{t("settings.danger.deleteAccountDesc")}</DialogDescription>
            </DialogHeader>

            <form action={formAction} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="delete-confirm">{t("settings.danger.yourEmail")}</FieldLabel>
                <Input
                  id="delete-confirm"
                  type="email"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={email}
                  autoComplete="off"
                  required
                />
                <FieldDescription>
                  {t("settings.danger.typeToConfirm", { email })}
                </FieldDescription>
              </Field>

              {state.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("settings.danger.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!confirmed || pending}
                >
                  {pending && <Loader2 className="animate-spin" />}
                  {t("settings.danger.deleteForever")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export function SettingsPage({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:px-0 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
      <ProfileCard name={name} email={email} />
      <AppearanceCard />
      <LanguageCard />
      <SignOutCard />
      <DangerCard email={email} />
    </div>
  );
}