import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    <section className={className}>
      <div className="container-page pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h1 className="text-pretty text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {heading}
          </h1>
          <p className="max-w-xl text-balance text-muted-foreground sm:text-lg">
            {description}
          </p>
          {button && (
            <Button asChild size="lg">
              <a href={button.url}>
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
