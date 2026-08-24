import { cn } from "@/lib/utils";

interface FooterLink {
  name: string;
  href: string;
}
interface FooterSection {
  title: string;
  links: FooterLink[];
}
interface FooterLogo {
  url: string;
  src: string;
  alt: string;
  title: string;
}

interface FooterBasicProps {
  logo?: FooterLogo;
  description?: string;
  sections?: FooterSection[];
  copyright?: string;
  legalLinks?: FooterLink[];
  className?: string;
}

interface Footer2Props extends FooterBasicProps {
  logoClassName?: string;
}
type Props = Partial<Footer2Props>;

const defaultProps: Footer2Props = {
  logo:{
    url: "https://blocapps.com",
    src: "",
    alt: "logo",
    title: "bloc",
  },
  description: "A block-based note taking for IT student",
    sections: [
    {
      title: "Navigation",
      links: [
        { name: "About", href: "#" },
        { name: "Features", href: "#" },
        { name: "Pricing", href: "#" },
      ],
    },
    {
      title: "Product",
      links: [
        { name: "Changelog", href: "#" },
        { name: "Roadmap", href: "#" },
        { name: "Templates", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Tutorials", href: "#" },
      ],
    },
    {
      title: "Community",
      links: [
        { name: "Discord", href: "#" },
        { name: "GitHub", href: "#" },
        { name: "Report a Bug", href: "#" },
      ],
    },
  ],
  copyright: "© 2024 Shadcnblocks.com. All rights reserved.",
  legalLinks: [
    { name: "Terms and Conditions", href: "#" },
    { name: "Privacy Policy", href: "#" },
  ],
};

const MAX_SECTIONS = 4;

const Footer2 = (props: Props) => {
  const { logo, description, sections, copyright, legalLinks, className } = {
    ...defaultProps,
    ...props,
  };

  const visibleSections = (sections ?? []).slice(0, MAX_SECTIONS);

  return (
    <section className={cn("py-16 md:py-24", className)}>
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <footer>
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-6">
            <div className="col-span-2 mb-8 lg:mb-0">
              <div className="flex items-center lg:justify-start">
                <a href="/" className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight">Bloc.</span>
                </a>
              </div>
              <p className="mt-4 text-lg text-muted-foreground">
                {description}
              </p>
            </div>
            {visibleSections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="mb-4 text-base font-semibold text-foreground">
                  {section.title}
                </h3>
                <ul className="space-y-4 text-lg text-muted-foreground">
                  {section.links.map((link, linkIdx) => (
                    <li
                      key={linkIdx}
                      className="font-medium hover:text-primary"
                    >
                      <a href={link.href}>{link.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground md:flex-row md:items-center">
            <p>{copyright}</p>
            <ul className="flex gap-4">
              {legalLinks?.map((link, linkIdx) => (
                <li key={linkIdx} className="underline hover:text-primary">
                  <a href={link.href}>{link.name}</a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </div>
    </section>
  );
};

export { Footer2 };
