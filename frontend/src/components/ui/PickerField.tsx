import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import "./picker-field.css";

type PickerFieldProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  placeholder?: string;
  value: string;
};

export function PickerField({
  disabled = false,
  label,
  onValueChange,
  options,
  placeholder = "Vyber",
  value,
}: PickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="text-field">
      <Text as="span" variant="label">
        {label}
      </Text>
      <button
        className="picker-field__trigger"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Text as="span" variant="body">
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown aria-hidden="true" size={18} />
      </button>

      <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} title={label}>
        <div className="picker-field__options" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                aria-selected={isSelected}
                className={
                  isSelected
                    ? "picker-field__option is-selected"
                    : "picker-field__option"
                }
                key={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                role="option"
                type="button"
              >
                <Text as="span" variant="body">
                  {option.label}
                </Text>
                {isSelected ? <Check aria-hidden="true" size={18} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
