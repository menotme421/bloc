import { cn } from "@/lib/utils";

type BlocLogoProps = {
  size?: number;
  className?: string;
};

/**
 * Shared Bloc brand mark. Drawn inline SVG (no <img>) matching the
 * PWA / desktop icon generated in `scripts/generate-icons.mjs`:
 * black rounded tile with three stacked block bars.
 */
export function BlocLogo({ size = 28, className }: BlocLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Bloc logo"
      className={cn("shrink-0", className)}
    >
      <rect width="512" height="512" rx="112" fill="#0a0a0a" />
      <rect x="136" y="128" width="240" height="80" rx="20" fill="#fafafa" />
      <rect x="136" y="216" width="176" height="80" rx="20" fill="#e4e4e7" />
      <rect x="136" y="304" width="208" height="80" rx="20" fill="#a1a1aa" />
    </svg>
  );
}
