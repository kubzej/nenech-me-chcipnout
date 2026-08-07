import type { ComponentPropsWithoutRef, ElementType } from "react";
import "./text.css";

export type TextVariant =
  | "display"
  | "heading"
  | "kicker"
  | "title"
  | "label"
  | "body"
  | "caption";

export type TextTone = "default" | "muted" | "earth" | "accent" | "danger";

const DEFAULT_ELEMENT: Record<TextVariant, ElementType> = {
  display: "h1",
  heading: "p",
  kicker: "p",
  title: "strong",
  label: "span",
  body: "p",
  caption: "small",
};

const DEFAULT_TONE: Record<TextVariant, TextTone> = {
  display: "default",
  heading: "default",
  kicker: "earth",
  title: "default",
  label: "muted",
  body: "default",
  caption: "muted",
};

type TextOwnProps<E extends ElementType> = {
  as?: E;
  tone?: TextTone;
  variant: TextVariant;
};

type TextProps<E extends ElementType> = TextOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof TextOwnProps<E>>;

export function Text<E extends ElementType = "span">({
  as,
  className,
  tone,
  variant,
  ...props
}: TextProps<E>) {
  const Component = as ?? DEFAULT_ELEMENT[variant];
  const classes = [
    "text",
    `text--${variant}`,
    `text--tone-${tone ?? DEFAULT_TONE[variant]}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes} {...props} />;
}
