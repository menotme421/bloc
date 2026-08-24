"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface Navbar1Props {
  className?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
    className?: string;
  };
  menu?: MenuItem[];
  auth?: {
    login: {
      title: string;
      url: string;
    };
    signup: {
      title: string;
      url: string;
    };
  };
}

const Navbar1 = ({
  logo = {
    url: "https://blocapps.com",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-icon.svg",
    alt: "logo",
    title: "bloc",
  },
  menu = [
    { title: "About", url: "#about" },
    { title: "Feature", url: "#features" },
    { title: "Pricing", url: "#pricing" },
  ],
  auth = {
    login: { title: "Sign in", url: "/auth?mode=signin" },
    signup: { title: "Sign up", url: "/auth" },
  },
  className,
}: Navbar1Props) => {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const handleNavClick = (url: string) => {
    setOpen(false);
    // small delay to let drawer close animation start, then client navigation (no full reload)
    setTimeout(() => {
      if (url.startsWith("#")) {
        const el = document.getElementById(url.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          try {
            window.history.pushState(null, "", url);
          } catch {}
          return;
        }
      }
      try {
        router.push(url);
      } catch {
        window.location.href = url;
      }
    }, 150);
  };

  return (
    <section className={cn("relative isolate py-4 pt-[max(1rem,env(safe-area-inset-top))] ", className)}>
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        {/* Desktop Menu */}
        <nav className="hidden items-center justify-between lg:flex">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">Bloc.</span>
            </a>
            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {menu.map((item) => renderMenuItem(item))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={auth.login.url}>{auth.login.title}</a>
            </Button>
            <Button size="sm" asChild>
              <a href={auth.signup.url}>{auth.signup.title}</a>
            </Button>
          </div>
        </nav>

        {/* Mobile Menu — simple fixed drawer, no Radix portal (reliable on IP/tunnel) */}
        <div className="block lg:hidden">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">Bloc.</span>
            </a>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="relative z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background touch-auto select-auto focus-visible:border-transparent focus-visible:ring-0 active:translate-y-px"
              style={{ WebkitUserSelect: "auto", userSelect: "auto", touchAction: "auto", WebkitTouchCallout: "default" } as React.CSSProperties}
            >
              <Menu className="size-4 pointer-events-none" />
            </button>
          </div>

          {open && (
            <>
               <div
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-xs touch-manipulation"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div className="fixed inset-y-0 right-0 z-50 flex w-3/4 max-w-sm flex-col gap-4 bg-popover p-4 shadow-lg overflow-y-auto border-l touch-manipulation">
                <div className="flex items-center justify-between">
                  <a href={logo.url} className="flex items-center gap-2" onClick={() => setOpen(false)}>
                    <span className="text-2xl font-black tracking-tight">Bloc.</span>
                  </a>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close menu" className="min-h-[44px] min-w-[44px] touch-manipulation">
                    <XIcon className="size-4 pointer-events-none" />
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  {menu.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleNavClick(item.url)}
                      className="flex min-h-[44px] w-full items-center rounded-md px-3 py-3 text-left text-sm font-semibold hover:bg-muted"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => handleNavClick(auth.login.url)} className="w-full min-h-[44px] touch-manipulation">
                    {auth.login.title}
                  </Button>
                  <Button type="button" onClick={() => handleNavClick(auth.signup.url)} className="w-full min-h-[44px] touch-manipulation">
                    {auth.signup.title}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

const renderMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground">
          {item.items.map((subItem) => (
            <NavigationMenuLink asChild key={subItem.title} className="w-80">
              <SubMenuLink item={subItem} />
            </NavigationMenuLink>
          ))}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink
        href={item.url}
        className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm transition-colors hover:bg-muted hover:text-accent-foreground"
      >
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const SubMenuLink = ({ item }: { item: MenuItem }) => {
  return (
    <a
      className="flex min-w-80 flex-row gap-4 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none hover:bg-muted hover:text-accent-foreground"
      href={item.url}
    >
      <div className="text-foreground">{item.icon}</div>
      <div>
        <div className="text-sm font-semibold">{item.title}</div>
        {item.description && <p className="text-sm">{item.description}</p>}
      </div>
    </a>
  );
};

export { Navbar1 };
