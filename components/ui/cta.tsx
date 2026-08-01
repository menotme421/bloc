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
      url: "https://shadcnblocks.com",
    },
    secondary: {
      text: "Schedule a Demo",
      url: "https://shadcnblocks.com",
    },
  },
};

const Cta39 = (props: Props) => {
  const { heading, description, buttons, className } = {
    ...defaultProps,
    ...props,
  };

  return (
    <section id="about" className={cn("section", className)}>
      <div className="container-page">
        <div className="mx-auto max-w-5xl rounded-md border border-dashed p-8 md:p-12 lg:p-16">
          <div className="flex flex-col items-center gap-4 text-center lg:gap-6">
            <h2 className="text-section">
              {heading}
            </h2>
            <p className="max-w-2xl text-body text-foreground-muted">
              {description}
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              {buttons?.primary && (
                <a href={buttons.primary.url} className="btn btn-primary btn-lg">
                  {buttons.primary.text}
                </a>
              )}
              {buttons?.secondary && (
                <a href={buttons.secondary.url} className="btn btn-secondary btn-lg">
                  {buttons.secondary.text}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta39 };