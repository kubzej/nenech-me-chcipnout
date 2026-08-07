import type { ReactNode } from "react";
import { Text } from "./Text";
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
      <Text variant="title">{title}</Text>
      {description ? (
        <Text variant="body" tone="muted">
          {description}
        </Text>
      ) : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
