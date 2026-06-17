import React from "react";

type FieldHintIconProps = {
  hint?: string;
};

export function FieldHintIcon({ hint }: FieldHintIconProps) {
  if (!hint) return null;
  return (
    <span
      title={hint}
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: "6px",
        cursor: "help",
        color: "var(--text-color-light, #888)"
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </span>
  );
}
