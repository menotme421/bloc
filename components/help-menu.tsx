"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  CircleHelpIcon,
  KeyboardIcon,
  LifeBuoyIcon,
  PlayIcon,
  RouteIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTour } from "@/hooks/use-tour";
import { useI18n } from "@/lib/i18n/provider";
import { DOCS } from "@/lib/docs";

function openDocs(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function HelpMenu({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { startQuickstart, startFullTour } = useTour(userId);

  return (
    <span data-tour="help" className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("help.menuLabel")}
          >
            <CircleHelpIcon className="size-4" />
            <span className="sr-only">{t("help.menuLabel")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>{t("help.toursTitle")}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void startQuickstart()}>
            <PlayIcon className="size-4" />
            <span className="flex flex-col items-start gap-0.5">
              <span>{t("tour.quickstart")}</span>
              <span className="text-xs text-muted-foreground">
                {t("tour.quickstartDesc")}
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void startFullTour()}>
            <RouteIcon className="size-4" />
            <span className="flex flex-col items-start gap-0.5">
              <span>{t("tour.fullTour")}</span>
              <span className="text-xs text-muted-foreground">
                {t("tour.fullTourDesc")}
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("help.resourcesTitle")}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/app/help">
              <BookOpenIcon className="size-4" />
              {t("help.helpCenter")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDocs(DOCS.home)}>
            <BookOpenIcon className="size-4" />
            {t("help.docs")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDocs(DOCS.shortcuts)}>
            <KeyboardIcon className="size-4" />
            {t("help.shortcuts")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDocs(DOCS.faq)}>
            <LifeBuoyIcon className="size-4" />
            {t("help.faq")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDocs(DOCS.troubleshooting)}>
            <WrenchIcon className="size-4" />
            {t("help.troubleshooting")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
