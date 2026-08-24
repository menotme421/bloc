import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface Button {
  text: string;
  url: string;
  icon?: React.ReactNode;
}
interface Buttons {
  primary?: Button;
  secondary?: Button;
}

interface CtaSimpleProps {
  heading: string;
  description: string;
  buttons?: Buttons;
  className?: string;
}

interface Cta39Props extends CtaSimpleProps {}
type Props = Partial<Cta39Props>;

const defaultProps: Cta39Props = {
  heading: "Your organized life started here",
  description:
    "Spend less time managing, more time learning",
  buttons: {
    primary: {
      text: "Get Started",
      url: "/auth",
    },
  },
};

const Cta39 = (props: Props) => {
  const { heading, description, buttons, className } = {
    ...defaultProps,
    ...props,
  };

  return (
    <section id="about" className={cn("py-16 md:py-24", className)}>
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="mx-auto max-w-5xl rounded-lg border border-dashed p-8 md:p-12 lg:p-16">
          <div className="flex flex-col items-center gap-4 text-center lg:gap-6">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {heading}
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground">
              {description}
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              {buttons?.primary && (
                <Button size="lg" asChild>
                  <a href={buttons.primary.url}>
                    {buttons.primary.text}
                  </a>
                </Button>
              )}
              {buttons?.secondary && (
                <Button variant="secondary" size="lg" asChild>
                  <a href={buttons.secondary.url}>
                    {buttons.secondary.text}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta39 };