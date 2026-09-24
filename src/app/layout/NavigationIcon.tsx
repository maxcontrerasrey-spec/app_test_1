import type { NavigationIconKey } from "../../shared/config/navigation";

export function NavigationIcon({ iconKey }: { iconKey?: NavigationIconKey }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (iconKey) {
    case "home":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" /></svg>;
    case "users":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...commonProps} cx="9" cy="8" r="4" /><path {...commonProps} d="M2.5 21v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2M16 4.5a4 4 0 0 1 0 7.5M18 14a4.5 4.5 0 0 1 3.5 4.4V21" /></svg>;
    case "heart-pulse":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /><path {...commonProps} d="M4.5 12h4l1.5-3 3 6 1.5-3h5" /></svg>;
    case "bus":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...commonProps} x="4" y="3" width="16" height="16" rx="3" /><path {...commonProps} d="M4 11h16M8 19v2m8-2v2M8 15h.01M16 15h.01M8 7h8" /></svg>;
    case "chart-pie":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M21 12A9 9 0 1 1 12 3v9h9Z" /><path {...commonProps} d="M15 3.5A8.5 8.5 0 0 1 20.5 9H15V3.5Z" /></svg>;
    case "user-plus":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle {...commonProps} cx="9" cy="7" r="4" /><path {...commonProps} d="M19 8v6M22 11h-6" /></svg>;
    case "arrow-right-left":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="m16 3 4 4-4 4M20 7H4m4 14-4-4 4-4M4 17h16" /></svg>;
    case "clipboard-list":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...commonProps} width="8" height="4" x="8" y="2" rx="1" /><path {...commonProps} d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4m-4 5h4M8 11h.01M8 16h.01" /></svg>;
    case "gauge":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M4.9 19a9 9 0 1 1 14.2 0m-7.1-6 4-4" /><circle {...commonProps} cx="12" cy="13" r="1.5" /></svg>;
    case "route":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...commonProps} cx="6" cy="18" r="2" /><circle {...commonProps} cx="18" cy="6" r="2" /><path {...commonProps} d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3" /></svg>;
    case "sparkles":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Zm6.5 11 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3ZM5 13l.6 1.8 1.8.6-1.8.6L5 18l-.6-1.8-1.8-.6 1.8-.6L5 13Z" /></svg>;
    case "download":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
    case "calendar-clock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5M16 2v4M8 2v4M3 10h5m9.5 7.5L16 16.3V14" /><circle {...commonProps} cx="16" cy="16" r="6" /></svg>;
    case "wallet":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></svg>;
    case "coins":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse {...commonProps} cx="12" cy="6" rx="7" ry="3" /><path {...commonProps} d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M8 20c1.1.6 2.5 1 4 1 3.9 0 7-1.3 7-3" /></svg>;
    case "brain":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M9.5 4A3.5 3.5 0 0 0 6 7.5v.3A3.5 3.5 0 0 0 4 14a3.5 3.5 0 0 0 3.5 3.5H9V4h.5ZM14.5 4A3.5 3.5 0 0 1 18 7.5v.3a3.5 3.5 0 0 1 2 6.2 3.5 3.5 0 0 1-3.5 3.5H15V4h-.5ZM9 9H7.5M15 9h1.5M9 14H7M15 14h2M12 4v16" /></svg>;
    case "user-check":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...commonProps} cx="9" cy="7" r="4" /><path {...commonProps} d="M2 21v-2a6 6 0 0 1 6-6h2m5 4 2 2 4-5" /></svg>;
    case "gavel":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="m14 5 5 5M12 7l5 5M4 20l9-9M3 21h8" /><rect {...commonProps} x="9" y="3" width="7" height="5" rx="1" transform="rotate(-45 12.5 5.5)" /></svg>;
    case "id-card":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...commonProps} x="3" y="5" width="18" height="14" rx="2" /><circle {...commonProps} cx="8" cy="11" r="2" /><path {...commonProps} d="M5.5 16a3 3 0 0 1 5 0M13 10h5M13 14h4" /></svg>;
    case "award":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...commonProps} cx="12" cy="8" r="5" /><path {...commonProps} d="m8.5 12-1 9 4.5-2 4.5 2-1-9M10 8l1.3 1.3L14 6.5" /></svg>;
    case "trending-up":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...commonProps} d="M8 4h6l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6 0v4h4M9 13h6" /></svg>;
  }
}
