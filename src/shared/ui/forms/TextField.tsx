import { ChangeEvent, HTMLInputTypeAttribute } from "react";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: HTMLInputTypeAttribute;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
  className?: string;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  disabled = false,
  placeholder,
  min,
  step,
  className = ""
}: TextFieldProps) {
  return (
    <div className={`field-group ${className}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={`text-field ${readOnly ? "text-field-readonly" : ""}`.trim()}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        step={step}
      />
    </div>
  );
}
