import {
  ArrowRight,
  Blocks,
  Globe,
  Layers,
  Palette,
  Rocket,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface FeatureCardListItem {
  title: string;
  description: string;
  image: Image;
  href?: string;
  icon?: React.ReactNode;
  label?: string;
}
interface Image {
  src: string;
  alt: string;
  srcDark?: string;
}
interface Button {
  text: string;
  url: string;
  icon?: React.ReactNode;
}
interface Buttons {
  primary?: Button;
  secondary?: Button;
}

interface FeatureCardListProps {
  heading: string;
  description?: string;
  features?: FeatureCardListItem[];
  buttons?: Buttons;
  className?: string;
}

interface Feature73Props extends FeatureCardListProps {}
type Props = Partial<Feature73Props>;

const defaultProps: Feature73Props = {
  heading: "Everything you need to stay organized",
  description:
    "From quick notes to seamless sync across devices, Bloc helps you focus on learning, not managing.",
  features: [
    {
      icon: <Zap className="size-5" />,
      title: "Web, not app",
      description:
        "Utilizing Progressive Web Application allows us to provide the same native app experience in a website form.",
      image: {
        src: "/image/features/Web,notapp.svg",
        alt: "Web,notapp",
      }, 
    },
    {
      icon: <Palette className="size-5" />,
      title: "Time is Gold",
      description:
        "Student should not spend their much time to manage their notes. Bloc help you to manage it",
      image: {
        src: "/image/features/Timeisgold.svg",
        alt: "TimeisGold",
      },
    },
    {
      icon: <Layers className="size-5" />,
      title: "Seamless",
      description:
        "Bloc is built to work seamlessly across Desktop, Laptop, Tablet, and Smartphone.",
      image: {
        src: "/image/features/Seamless.svg",
        alt: "Seamless",
      },
    },
   
  ],
};

const Feature73 = (props: Props) => {
  const { heading, description, buttons, features, className } = {
    ...defaultProps,
    ...props,
  };

  return (
    <section className={cn("py-32", className)}>
      <div className="container mx-auto">
        <div className="mx-auto mb-9 text-center lg:mb-14 lg:max-w-3xl">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight text-balance md:mb-4 md:text-4xl lg:mb-6">
            {heading}
          </h2>
          {description && (
            <p className="mb-8 text-muted-foreground lg:text-lg">
              {description}
            </p>
          )}
          {buttons?.primary && (
            <Button variant="link" asChild>
              <a
                href={buttons.primary.url}
                className="group flex items-center font-medium md:text-base lg:text-lg"
              >
                {buttons.primary.text}
                <ArrowRight />
              </a>
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features?.slice(0, 3).map((feature, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-[50px] rounded-md bg-card p-5 text-center"
            >
              <a href={feature.href}>
                <img
                  src={feature.image.src}
                  alt={feature.image.alt}
                  className="h-auto w-full max-w-[216px] transition-opacity hover:opacity-80"
                />
              </a>
              <div>
                <h3 className="mb-2 text-base font-semibold md:text-lg">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground md:text-base lg:text-lg">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export { Feature73 };
