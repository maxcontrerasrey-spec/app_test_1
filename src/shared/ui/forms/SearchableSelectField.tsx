import { ChangeEvent, useState, useRef, useEffect, KeyboardEvent } from "react";
import type { SelectOption } from "./SelectField";

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  renderOption?: (opt: SelectOption) => React.ReactNode;
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
    onChange({
      target: { name: id, value: selectedValue, id },
      currentTarget: { name: id, value: selectedValue, id }
    } as unknown as ChangeEvent<HTMLSelectElement>);
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
      className={`field-group ${className}`.trim()} 
      ref={containerRef} 
      style={{ position: 'relative', zIndex: isOpen ? 9999 : undefined }}
    >
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          className="text-field"
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
          style={{ 
            width: '100%', 
            cursor: disabled ? 'not-allowed' : 'text',
            paddingRight: '32px' 
          }}
        />
        <svg 
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} 
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && !disabled && (
        <ul style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, 
          maxHeight: '220px', overflowY: 'auto', background: 'var(--surface)', 
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
          boxShadow: 'var(--shadow-popover)', marginTop: '4px', padding: '4px 0',
          listStyle: 'none', marginBlockStart: '4px', marginBlockEnd: 0, marginInlineStart: 0, marginInlineEnd: 0, paddingInlineStart: 0
        }}>
          {filteredOptions.length === 0 ? (
            <li style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No se encontraron opciones</li>
          ) : (
            filteredOptions.map((opt) => (
              <li 
                key={opt.value} 
                onClick={() => handleSelect(opt.value)}
                style={{ 
                  padding: '8px 12px', cursor: 'pointer', fontSize: '0.92rem',
                  background: opt.value === value ? 'var(--surface-muted)' : 'transparent',
                  color: 'var(--title)',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = opt.value === value ? 'var(--surface-muted)' : 'transparent')}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </li>
            ))
          )}
        </ul>
      )}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
