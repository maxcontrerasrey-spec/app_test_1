import { useState, useRef, useEffect } from "react";
import type { SelectOption } from "./SelectField";

type MultiSelectFieldProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  hideLabel?: boolean;
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
  searchPlaceholder = "Buscar opciones",
  searchable = false,
  hideLabel = false,
  disabled = false,
  className = ""
}: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const hasOptions = options.length > 0;
  const areAllSelected = hasOptions && value.length === options.length;
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase("es-CL");
  const visibleOptions = normalizedSearchTerm
    ? options.filter((option) =>
        `${option.label} ${option.value}`.toLocaleLowerCase("es-CL").includes(normalizedSearchTerm)
      )
    : options;

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
    const visibleValues = visibleOptions.map((option) => option.value);
    onChange(Array.from(new Set([...value, ...visibleValues])));
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`field-group select-field multi-select-field ${isOpen ? "select-field-open" : ""} ${className}`.trim()} ref={containerRef}>
      <label className={`field-label ${hideLabel ? "field-label-visually-hidden" : ""}`} htmlFor={id}>
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
              {searchable ? (
                <div className="multi-select-search-wrap">
                  <input
                    id={`${id}-search`}
                    className="multi-select-search-input"
                    type="search"
                    value={searchTerm}
                    placeholder={searchPlaceholder}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    autoComplete="off"
                  />
                </div>
              ) : null}

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

              {visibleOptions.length === 0 ? (
                <div className="multi-select-empty">Sin coincidencias</div>
              ) : null}

              {visibleOptions.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={(event) => {
                      // La opción vive dentro del trigger. Detener el bubbling
                      // mantiene abierto el menú para seleccionar varios valores.
                      event.stopPropagation();
                      toggleOption(opt.value);
                    }}
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
