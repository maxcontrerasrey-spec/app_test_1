import {
  ChangeEvent,
  FocusEvent,
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute,
  InputHTMLAttributes
} from "react";
import { FieldHintIcon } from "./FieldHintIcon";

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
  hint?: string;
  hideLabel?: boolean;
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
  className = "",
  hint,
  hideLabel = false
}: TextFieldProps) {
  return (
    <div className={`field-group ${className}`.trim()}>
      <label className={`field-label ${hideLabel ? "field-label-visually-hidden" : ""}`.trim()} htmlFor={id}>
        {label}
        <FieldHintIcon hint={hint} />
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
