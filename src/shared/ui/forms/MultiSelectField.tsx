import { useState, useRef, useEffect } from "react";
import type { SelectOption } from "./SelectField";

type MultiSelectFieldProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function MultiSelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccione opciones",
  disabled = false,
  className = ""
}: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasOptions = options.length > 0;
  const areAllSelected = hasOptions && value.length === options.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const handleSelectAll = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange(options.map((option) => option.value));
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`field-group select-field multi-select-field ${isOpen ? "select-field-open" : ""} ${className}`.trim()} ref={containerRef}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>

      <div
        className={`text-field select-trigger multi-select-trigger ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
      >
        {selectedOptions.length === 0 ? (
          <span className="multi-select-placeholder">{placeholder}</span>
        ) : areAllSelected ? (
          <span className="multi-select-summary">
            Todas las opciones ({selectedOptions.length})
          </span>
        ) : selectedOptions.length === 1 ? (
          <span
            key={selectedOptions[0].value}
            className="multi-select-pill"
          >
            {selectedOptions[0].label}
            <button
              type="button"
              onClick={(e) => handleRemove(e, selectedOptions[0].value)}
              className="multi-select-pill-remove"
              aria-label={`Quitar ${selectedOptions[0].label}`}
            >
              &times;
            </button>
          </span>
        ) : (
          <span className="multi-select-summary">
            Varios elementos ({selectedOptions.length})
          </span>
        )}
      </div>

      {isOpen && (
        <div
          id={`${id}-options`}
          className="multi-select-dropdown"
          role="listbox"
          aria-multiselectable="true"
        >
          {options.length === 0 ? (
            <div className="multi-select-empty">No hay opciones</div>
          ) : (
            <>
              <div className="multi-select-actions">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="multi-select-action-button multi-select-action-button-primary"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="multi-select-action-button"
                >
                  Limpiar
                </button>
              </div>

              {options.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={`multi-select-option ${isSelected ? "is-selected" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="multi-select-checkbox"
                    />
                    <span>{opt.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
