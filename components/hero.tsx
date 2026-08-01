import { ArrowRight } from "lucide-react";

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
    url: "#",
  },
};

const Hero1 = (props: Props) => {
  const { heading, description, button, className } = {
    ...defaultProps,
    ...props,
  };

  return (
    <section className={cn("section", className)}>
      <div className="container-page">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h1 className="text-pretty text-hero">
            {heading}
          </h1>
          <p className="max-w-xl text-balance text-body text-foreground-muted">
            {description}
          </p>
          {button && (
            <a href={button.url} className="btn btn-nav btn-primary flex items-center gap-2">
              {button.text}
              <ArrowRight className="size-4" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export { Hero1 };
