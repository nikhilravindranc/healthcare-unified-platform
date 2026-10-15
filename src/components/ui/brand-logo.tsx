"use client";
import { Logo } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** The practice's own logo when its custom theme has one, otherwise the standard logo. */
export function BrandLogo({ variant = "full", height = 28, className }: { variant?: "full" | "icon"; height?: number; className?: string }) {
  const { theme, custom } = useSettings();
  if (theme === "custom" && custom?.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={custom.logo} alt={`${custom.name} logo`} draggable={false} style={{ height, maxWidth: variant === "icon" ? height : height * 4 }} className={cn("block shrink-0 object-contain", className)} />;
  }
  return <Logo variant={variant} height={height} className={className} />;
}
