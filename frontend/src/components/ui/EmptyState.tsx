import type { ReactNode } from "react";
import "./empty-state.css";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "stack" | "inline";
};

export function EmptyState({
  action,
  description,
  icon,
  title,
  variant = "stack",
}: EmptyStateProps) {
  const classes = ["empty-state", `empty-state--${variant}`].join(" ");

  return (
    <div className={classes}>
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
