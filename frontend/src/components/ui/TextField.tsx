import type { InputHTMLAttributes } from "react";
import { Text } from "./Text";
import "./text-field.css";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextField({ id, label, ...props }: TextFieldProps) {
  const inputId = id ?? props.name ?? label;

  return (
    <label className="text-field" htmlFor={inputId}>
      <Text as="span" variant="label">
        {label}
      </Text>
      <input id={inputId} {...props} />
    </label>
  );
}

