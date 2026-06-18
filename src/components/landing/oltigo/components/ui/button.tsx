import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-[background,color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-emerald focus-visible:outline-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // The single living-color CTA. Use sparingly — one per section.
        primary: "bg-emerald text-ink hover:bg-[var(--color-emerald-deep)] hover:text-text shadow-[0_14px_32px_-20px_rgba(16,185,129,0.55)]",
        secondary: "border border-hairline bg-surface/40 text-text-secondary hover:text-text hover:border-text-muted",
        ghost: "text-text-secondary hover:text-text",
        outline: "border border-hairline text-text hover:border-emerald/60",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & { href?: string };

export function Button({ className, variant, size, href, ...props }: ButtonProps) {
  const classes = cn(button({ variant, size }), className);
  if (href) {
    const { type: _type, ...anchorProps } = props;
    void _type;
    return (
      <a href={href} className={classes} {...(anchorProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)} />
    );
  }
  return <button className={classes} {...props} />;
}
