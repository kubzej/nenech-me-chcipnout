import type { InputHTMLAttributes } from "react";
import "./text-field.css";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextField({ id, label, ...props }: TextFieldProps) {
  const inputId = id ?? props.name ?? label;

  return (
    <label className="text-field" htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} {...props} />
    </label>
  );
}

