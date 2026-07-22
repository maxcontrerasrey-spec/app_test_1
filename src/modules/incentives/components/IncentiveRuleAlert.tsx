function EmergencyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="hr-incentives-rule-alert-icon"
      focusable="false"
      viewBox="0 0 20 20"
    >
      <path
        d="M10 1.75 3.15 4.1 1.75 10l1.4 5.9L10 18.25l6.85-2.35 1.4-5.9-1.4-5.9L10 1.75Zm.05 4.2c.5 0 .9.39.9.88v4.52a.9.9 0 0 1-1.8 0V6.83c0-.49.4-.88.9-.88Zm0 8.2a1.03 1.03 0 1 1 0-2.05 1.03 1.03 0 0 1 0 2.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IncentiveRuleAlert({ children }: { children: string }) {
  return (
    <div className="hr-incentives-rule-alert" role="alert">
      <div className="hr-incentives-rule-alert-icon-shell" aria-hidden="true">
        <EmergencyIcon />
      </div>
      <div className="hr-incentives-rule-alert-copy">
        <strong className="hr-incentives-rule-alert-title">Bloqueo operativo</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}
