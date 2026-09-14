"use client";

import {
  BookOpenIcon,
  KeyboardIcon,
  LifeBuoyIcon,
  PlayIcon,
  RouteIcon,
  WrenchIcon,
  PenLineIcon,
  TagsIcon,
  SearchIcon,
  HistoryIcon,
  CloudUploadIcon,
  UserRoundIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTour } from "@/hooks/use-tour";
import { useI18n } from "@/lib/i18n/provider";
import { DOCS, type DocKey } from "@/lib/docs";

function openDocs(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

const GUIDE_CARDS: {
  icon: typeof BookOpenIcon;
  titleKey: string;
  descKey: string;
  doc: DocKey;
}[] = [
  { icon: PlayIcon, titleKey: "help.cards.quickstartTitle", descKey: "help.cards.quickstartDesc", doc: "quickstart" },
  { icon: PenLineIcon, titleKey: "help.cards.editorTitle", descKey: "help.cards.editorDesc", doc: "editor" },
  { icon: TagsIcon, titleKey: "help.cards.organizingTitle", descKey: "help.cards.organizingDesc", doc: "organizing" },
  { icon: SearchIcon, titleKey: "help.cards.searchTitle", descKey: "help.cards.searchDesc", doc: "search" },
  { icon: HistoryIcon, titleKey: "help.cards.historyTitle", descKey: "help.cards.historyDesc", doc: "history" },
  { icon: CloudUploadIcon, titleKey: "help.cards.syncTitle", descKey: "help.cards.syncDesc", doc: "offline" },
  { icon: KeyboardIcon, titleKey: "help.cards.shortcutsTitle", descKey: "help.cards.shortcutsDesc", doc: "shortcuts" },
  { icon: UserRoundIcon, titleKey: "help.cards.accountTitle", descKey: "help.cards.accountDesc", doc: "profile" },
  { icon: LifeBuoyIcon, titleKey: "help.cards.faqTitle", descKey: "help.cards.faqDesc", doc: "faq" },
  { icon: WrenchIcon, titleKey: "help.cards.troubleshootTitle", descKey: "help.cards.troubleshootDesc", doc: "troubleshooting" },
];

export function HelpPageClient({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { startQuickstart, startFullTour } = useTour(userId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:px-0 md:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("help.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("help.desc")}</p>
      </div>

      <Card data-tour="settings">
        <CardHeader>
          <CardTitle>{t("help.toursTitle")}</CardTitle>
          <CardDescription>{t("help.toursDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => void startQuickstart()}
            className="flex-1"
          >
            <PlayIcon className="size-4" />
            {t("tour.quickstart")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void startFullTour()}
            className="flex-1"
          >
            <RouteIcon className="size-4" />
            {t("tour.fullTour")}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold">{t("help.guidesTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GUIDE_CARDS.map(({ icon: Icon, titleKey, descKey, doc }) => (
            <Card key={doc + titleKey} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-muted-foreground" />
                  {t(titleKey)}
                </CardTitle>
                <CardDescription>{t(descKey)}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openDocs(DOCS[doc])}
                >
                  <BookOpenIcon className="size-3.5" />
                  {t("help.openDocs")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
