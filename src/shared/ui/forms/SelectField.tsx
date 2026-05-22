import { ChangeEvent } from "react";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccione una opción",
  disabled = false,
  className = ""
}: SelectFieldProps) {
  return (
    <div className={`field-group ${className}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        className="text-field"
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
