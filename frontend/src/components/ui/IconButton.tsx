import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./icon-button.css";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string;
  variant?: "ghost" | "surface";
};

export function IconButton({
  className,
  icon,
  label,
  type = "button",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  const classes = ["icon-button", `icon-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button aria-label={label} className={classes} title={label} type={type} {...props}>
      {icon}
    </button>
  );
}
