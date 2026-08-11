import { Text } from "./Text";
import "./choice-field.css";

type ChoiceFieldProps<TValue extends string> = {
  disabled?: boolean;
  label: string;
  onValueChange: (value: TValue) => void;
  options: ReadonlyArray<{
    label: string;
    value: TValue;
  }>;
  value: TValue;
};

export function ChoiceField<TValue extends string>({
  disabled = false,
  label,
  onValueChange,
  options,
  value,
}: ChoiceFieldProps<TValue>) {
  return (
    <div className="choice-field">
      <Text as="span" variant="label">
        {label}
      </Text>
      <div aria-label={label} className="choice-field__options" role="radiogroup">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              aria-checked={isSelected}
              className={isSelected ? "choice-field__option is-selected" : "choice-field__option"}
              disabled={disabled}
              key={option.value}
              onClick={() => onValueChange(option.value)}
              role="radio"
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
