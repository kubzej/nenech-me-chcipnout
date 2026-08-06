import type { HTMLAttributes } from "react";
import "./panel.css";

type PanelProps = HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: PanelProps) {
  const classes = ["panel", className].filter(Boolean).join(" ");

  return <div className={classes} {...props} />;
}

