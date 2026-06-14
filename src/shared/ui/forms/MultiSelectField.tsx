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

  return (
    <div className={`field-group ${className}`.trim()} ref={containerRef} style={{ position: "relative" }}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>

      <div
        className={`text-field ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          minHeight: "38px",
          height: "auto",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          cursor: disabled ? "not-allowed" : "pointer",
          padding: "4px 8px",
          alignItems: "center"
        }}
      >
        {selectedOptions.length === 0 ? (
          <span style={{ color: "#9ca3af", padding: "4px 0" }}>{placeholder}</span>
        ) : selectedOptions.length === 1 ? (
          <span
            key={selectedOptions[0].value}
            style={{
              backgroundColor: "#e5e7eb",
              color: "#374151",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {selectedOptions[0].label}
            <button
              type="button"
              onClick={(e) => handleRemove(e, selectedOptions[0].value)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                fontSize: "1rem",
                lineHeight: 1
              }}
            >
              &times;
            </button>
          </span>
        ) : (
          <span style={{ color: "#374151", padding: "4px 0", fontSize: "0.875rem" }}>
            Varios elementos ({selectedOptions.length})
          </span>
        )}
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "white",
            border: "1px solid #d1d5db",
            borderRadius: "0.375rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            zIndex: 50,
            maxHeight: "200px",
            overflowY: "auto"
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: "8px 12px", color: "#6b7280" }}>No hay opciones</div>
          ) : (
            options.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#f3f4f6" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? "#f3f4f6" : "transparent";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ color: "#374151" }}>{opt.label}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
