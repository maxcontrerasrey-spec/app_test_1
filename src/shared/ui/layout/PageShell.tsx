import { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  useFormShell?: boolean;
};

export function PageShell({ children, className = "", useFormShell = false }: PageShellProps) {
  return (
    <section className={`page ${className}`.trim()}>
      {useFormShell ? (
        <section className="form-shell">
          {children}
        </section>
      ) : (
        children
      )}
    </section>
  );
}
