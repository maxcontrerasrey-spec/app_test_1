import {
  ChangeEvent,
  FocusEvent,
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute,
  InputHTMLAttributes
} from "react";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  type?: HTMLInputTypeAttribute;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: HTMLInputAutoCompleteAttribute;
  hasError?: boolean;
  className?: string;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  readOnly = false,
  disabled = false,
  placeholder,
  min,
  step,
  inputMode,
  autoComplete,
  hasError = false,
  className = ""
}: TextFieldProps) {
  return (
    <div className={`field-group ${className}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={`text-field ${readOnly ? "text-field-readonly" : ""} ${hasError ? "text-field-error" : ""}`.trim()}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        step={step}
        inputMode={inputMode}
        autoComplete={autoComplete}
      />
    </div>
  );
}
