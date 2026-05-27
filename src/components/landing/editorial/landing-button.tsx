"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const heightMap: Record<ButtonSize, string> = {
  sm: "32px",
  md: "44px",
  lg: "52px",
};

const paddingMap: Record<ButtonSize, string> = {
  sm: "var(--space-3)",
  md: "var(--space-5)",
  lg: "var(--space-6)",
};

const iconSizeMap: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

/**
 * Landing page button — primary / secondary / ghost variants.
 *
 * Primary: bg --oltigo-green, text --bone, radius 8.
 * Secondary: bg --bone, border --ink, text --ink.
 * Ghost: bg none, text --oltigo-green, no border.
 */
export function LandingButton({
  variant = "primary",
  size = "md",
  href,
  children,
  showArrow = false,
  fullWidth = false,
  type = "button",
  disabled = false,
  onClick,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  children: React.ReactNode;
  showArrow?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    height: heightMap[size],
    paddingInline: paddingMap[size],
    borderRadius: "var(--radius-landing)",
    fontFamily: "var(--font-sans-landing)",
    fontSize: "var(--text-small)",
    fontWeight: 500,
    lineHeight: "var(--lh-small)",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transitionProperty: "background-color, color, border-color",
    transitionDuration: "var(--duration)",
    transitionTimingFunction: "var(--easing)",
    width: fullWidth ? "100%" : undefined,
    border: "none",
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: disabled ? "rgba(11, 15, 14, 0.12)" : "var(--oltigo-green)",
      color: disabled ? "rgba(11, 15, 14, 0.36)" : "var(--bone)",
    },
    secondary: {
      backgroundColor: "var(--bone)",
      color: disabled ? "rgba(11, 15, 14, 0.36)" : "var(--ink)",
      border: `1px solid ${disabled ? "rgba(11, 15, 14, 0.24)" : "var(--ink)"}`,
    },
    ghost: {
      backgroundColor: "transparent",
      color: disabled ? "rgba(11, 15, 14, 0.36)" : "var(--oltigo-green)",
    },
  };

  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
  };

  const arrow = showArrow ? (
    <ArrowRight
      size={iconSizeMap[size]}
      strokeWidth={1.5}
      className="cta-arrow transition-transform"
      style={{
        transitionDuration: "var(--duration)",
        transitionTimingFunction: "var(--easing)",
      }}
    />
  ) : null;

  if (href && !disabled) {
    return (
      <Link href={href} style={combinedStyles} className="landing-btn group">
        {children}
        {arrow}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={combinedStyles}
      className="landing-btn group"
    >
      {children}
      {arrow}
    </button>
  );
}
