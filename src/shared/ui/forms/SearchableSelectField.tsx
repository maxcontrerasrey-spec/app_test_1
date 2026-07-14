import { ChangeEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { createSelectChangeEvent, type SelectOption } from "./SelectField";
import { FieldHintIcon } from "./FieldHintIcon";

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  renderOption?: (opt: SelectOption) => ReactNode;
  hint?: string;
};

export function SearchableSelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccione una opción",
  disabled = false,
  className = "",
  renderOption,
  hint
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : "");

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (selectedValue: string) => {
    onChange(createSelectChangeEvent(id, selectedValue));
    setIsOpen(false);
    setSearchTerm("");
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter" && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[0].value);
    }
  };

  return (
    <div
      className={`field-group select-field searchable-select-field ${isOpen ? "select-field-open" : ""} ${className}`.trim()}
      ref={containerRef}
    >
      <label className="field-label" htmlFor={id}>
        {label}
        <FieldHintIcon hint={hint} />
      </label>
      <div className="searchable-select-control">
        <input
          ref={inputRef}
          type="text"
          className="text-field select-search-input"
          id={id}
          value={displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm("");
          }}
          onClick={() => {
            setIsOpen(true);
            setSearchTerm("");
          }}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <span className="select-trigger-icon searchable-select-icon" aria-hidden="true">▾</span>
      </div>

      {isOpen && !disabled && (
        <ul className="select-dropdown searchable-select-dropdown" role="listbox">
          {filteredOptions.length === 0 ? (
            <li className="select-empty">No se encontraron opciones</li>
          ) : (
            filteredOptions.map((opt) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`select-option ${opt.value === value ? "is-selected" : ""}`}
                role="option"
                aria-selected={opt.value === value}
              >
                <span className="select-option-check" aria-hidden="true">{opt.value === value ? "✓" : ""}</span>
                {renderOption ? renderOption(opt) : opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
