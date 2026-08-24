import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface HeroButton {
  text: string;
  url: string;
}

interface HeroProps {
  heading: string;
  description: string;
  button?: HeroButton;
  className?: string;
}

type Props = Partial<HeroProps>;

const defaultProps: HeroProps = {
  heading: "Stay Organized",
  description:
    "Don't waste time in database, create and write your notes. We will do it for you",
  button: {
    text: "Get Started",
    url: "/auth",
  },
};

const Hero1 = (props: Props) => {
  const { heading, description, button, className } = {
    ...defaultProps,
    ...props,
  };

  return (
    <section className={cn("py-16 md:py-24", className)}>
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-balance text-pretty md:text-5xl">
            {heading}
          </h1>
          <p className="max-w-xl text-lg text-balance text-muted-foreground">
            {description}
          </p>
          {button && (
            <Button size="lg" asChild>
              <a href={button.url} className="flex items-center gap-2">
                {button.text}
                <ArrowRight className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export { Hero1 };
