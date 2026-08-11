import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "ghost";
};

export function Button({
  children,
  className,
  icon,
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = ["button", `button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type="button" {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

