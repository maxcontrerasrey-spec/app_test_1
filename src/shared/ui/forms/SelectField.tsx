import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { FieldHintIcon } from "./FieldHintIcon";

export type SelectOption = {
  value: string;
  label: string;
  raw?: unknown;
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
  hint?: string;
  hideLabel?: boolean;
  includePlaceholder?: boolean;
  "aria-invalid"?: boolean;
};

export function createSelectChangeEvent(id: string, value: string): ChangeEvent<HTMLSelectElement> {
  return {
    target: { name: id, value, id },
    currentTarget: { name: id, value, id }
  } as unknown as ChangeEvent<HTMLSelectElement>;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccione una opción",
  disabled = false,
  className = "",
  hint,
  hideLabel = false,
  includePlaceholder = true,
  "aria-invalid": ariaInvalid
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const allOptions = useMemo(
    () => (includePlaceholder ? [{ value: "", label: placeholder }, ...options] : options),
    [includePlaceholder, options, placeholder]
  );
  const selectedOption = allOptions.find((option) => option.value === value) ?? allOptions[0] ?? { value: "", label: placeholder };
  const selectedIndex = Math.max(
    0,
    allOptions.findIndex((option) => option.value === selectedOption.value)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const selectValue = (nextValue: string) => {
    onChange(createSelectChangeEvent(id, nextValue));
    closeMenu();
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (allOptions.length === 0) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!isOpen) {
        openMenu();
        return;
      }
      setActiveIndex((current) => {
        const safeCurrent = current < 0 ? selectedIndex : current;
        return (safeCurrent + direction + allOptions.length) % allOptions.length;
      });
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (allOptions.length === 0) return;
      if (!isOpen) {
        openMenu();
        return;
      }
      selectValue(allOptions[Math.max(activeIndex, selectedIndex)]?.value ?? "");
      return;
    }

    if (event.key === "Escape") {
      closeMenu();
    }
  };

  return (
    <div className={`field-group select-field ${isOpen ? "select-field-open" : ""} ${className}`.trim()} ref={containerRef}>
      <label className={`field-label ${hideLabel ? "field-label-visually-hidden" : ""}`} id={`${id}-label`} htmlFor={id}>
        {label}
        <FieldHintIcon hint={hint} />
      </label>
      <button
        ref={triggerRef}
        type="button"
        className={`text-field select-trigger ${!selectedOption.value ? "select-trigger-placeholder" : ""}`}
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        aria-labelledby={`${id}-label ${id}`}
        aria-invalid={ariaInvalid}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="select-trigger-value">{selectedOption.label}</span>
        <span className="select-trigger-icon" aria-hidden="true">▾</span>
      </button>

      {isOpen && !disabled ? (
        <div className="select-dropdown" id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`}>
          {allOptions.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <button
                type="button"
                key={`${option.value}-${option.label}`}
                className={`select-option ${isSelected ? "is-selected" : ""} ${isActive ? "is-active" : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => selectValue(option.value)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="select-option-check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                <span className="select-option-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
