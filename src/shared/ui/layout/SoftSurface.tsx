import type { HTMLAttributes, ReactNode } from "react";

type SoftSurfaceTag = "article" | "aside" | "div" | "header" | "section";
type SoftSurfaceVariant = "raised" | "panel" | "inset" | "accent";
type SoftSurfaceDensity = "compact" | "default" | "spacious";

type SoftSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: SoftSurfaceTag;
  children: ReactNode;
  className?: string;
  density?: SoftSurfaceDensity;
  interactive?: boolean;
  variant?: SoftSurfaceVariant;
};

export function SoftSurface({
  as = "div",
  children,
  className = "",
  density = "default",
  interactive = false,
  variant = "raised",
  ...rest
}: SoftSurfaceProps) {
  const Component = as;
  const classes = [
    "soft-surface",
    `soft-surface--${variant}`,
    `soft-surface--${density}`,
    interactive ? "soft-surface--interactive" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
