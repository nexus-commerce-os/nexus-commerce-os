import type { ReactNode, MouseEventHandler, CSSProperties } from "react";

export type ButtonProps = {
  variant?: "primary" | "ghost";
  /** When provided the button renders as an anchor. */
  href?: string;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: MouseEventHandler;
  style?: CSSProperties;
};

/**
 * NEXUS action button. Styling comes from the consuming app's global tokens
 * (`.btn`, `.btn-primary`, `.btn-ghost`) — a headless-with-global-tokens primitive.
 */
export function Button({
  variant = "primary",
  href,
  children,
  className,
  type = "button",
  disabled = false,
  onClick,
  style,
}: ButtonProps) {
  const cls = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button
      className={cls}
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}
