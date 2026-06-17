import type { DashboardBirthdayItem } from "../types";

type DashboardBirthdayCardProps = {
  birthdays: DashboardBirthdayItem[];
  birthdayIndex: number;
  nextBirthday: DashboardBirthdayItem | null;
  birthdaySummary: string;
  onMove: (direction: "prev" | "next") => void;
  onSelect: (index: number) => void;
};

export function DashboardBirthdayCard({
  birthdays,
  birthdayIndex,
  nextBirthday,
  birthdaySummary,
  onMove,
  onSelect
}: DashboardBirthdayCardProps) {
  return (
    <article className="dashboard-info-card dashboard-info-card-birthday dashboard-birthday-card">
      {nextBirthday ? (
        <>
          <div className="dashboard-birthday-card-header">
            <svg
              className="dashboard-birthday-card-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
              <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2 1 2 1" />
              <path d="M2 21h20" />
              <path d="M7 8v3" />
              <path d="M12 8v3" />
              <path d="M17 8v3" />
              <path d="M7 4h.01" />
              <path d="M12 4h.01" />
              <path d="M17 4h.01" />
            </svg>
            {birthdays.length > 1 ? (
              <div className="dashboard-birthday-controls" aria-label="Navegación de cumpleaños">
                <button type="button" className="dashboard-birthday-control" onClick={() => onMove("prev")} aria-label="Cumpleañero anterior">
                  ‹
                </button>
                <button type="button" className="dashboard-birthday-control" onClick={() => onMove("next")} aria-label="Siguiente cumpleañero">
                  ›
                </button>
              </div>
            ) : null}
          </div>
          <div className="dashboard-birthday-summary">
            <strong className="dashboard-birthday-summary-name">{nextBirthday.full_name}</strong>
            <small className="dashboard-birthday-summary-detail">
              {nextBirthday.birthday_label} · <span className="dashboard-birthday-summary-emphasis">{birthdaySummary}</span>
            </small>
          </div>
          {birthdays.length > 1 ? (
            <div className="dashboard-birthday-pagination dashboard-birthday-pagination-spaced" aria-label="Posición del cumpleañero">
              {birthdays.map((birthday, index) => (
                <button
                  key={birthday.id}
                  type="button"
                  className={`dashboard-birthday-dot${index === birthdayIndex ? " is-active" : ""}`}
                  onClick={() => onSelect(index)}
                  aria-label={`Ver cumpleañero ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="dashboard-birthday-empty">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dashboard-birthday-empty-icon"
          >
            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
            <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2 1 2 1" />
            <path d="M2 21h20" />
          </svg>
          <span className="dashboard-birthday-empty-label">No hay cumpleaños próximos</span>
        </div>
      )}
    </article>
  );
}
