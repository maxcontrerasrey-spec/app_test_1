import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { homeNavigationItem, navigationSections } from "../../shared/config/navigation";
import logo from "../../assets/app-logo.png";
import { hasModuleAccess } from "../../modules/auth/config/access";
import { useAuth } from "../../modules/auth/context/AuthContext";

export function AppShell() {
  const location = useLocation();
  const { accessibleModules, displayName, email, isSuperAdmin, jobTitle, signOut } =
    useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleSections = useMemo(
    () =>
      navigationSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => isSuperAdmin || hasModuleAccess(accessibleModules, item.moduleCode)
          )
        }))
        .filter((section) => section.items.length > 0),
    [accessibleModules, isSuperAdmin]
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navigationSections.map((section) => [
        section.title,
        section.items.some((item) => location.pathname.startsWith(item.to))
      ])
    )
  );

  const toggleSection = (title: string) => {
    setOpenSections((current) => {
      const nextValue = !current[title];

      if (!nextValue) {
        setHoveredSection((hovered) => (hovered === title ? null : hovered));
      }

      return {
        ...current,
        [title]: nextValue
      };
    });
  };

  const collapseAllSections = () => {
    setHoveredSection(null);
    setOpenSections(Object.fromEntries(visibleSections.map((section) => [section.title, false])));
  };

  const userInitials = useMemo(() => {
    const initials = displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk.charAt(0).toUpperCase())
      .join("");

    return initials || "U";
  }, [displayName]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isUserMenuOpen]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink
          aria-label="Ir al inicio"
          className="brand-block"
          to="/"
          onClick={collapseAllSections}
        >
          <img alt="Logo JM" className="app-logo app-logo-sidebar" src={logo} />
          <span className="brand-kicker">AMBIENTE DE DESARROLLO [MC]</span>
        </NavLink>

        <nav className="nav-menu" aria-label="Modulos">
          <NavLink
            key={homeNavigationItem.to}
            to={homeNavigationItem.to}
            onClick={collapseAllSections}
            className={({ isActive }) =>
              isActive ? "nav-item nav-item-active" : "nav-item"
            }
          >
            <span>{homeNavigationItem.label}</span>
          </NavLink>

          {visibleSections.map((section) => (
            (() => {
              const isSectionActive = section.items.some((item) =>
                location.pathname.startsWith(item.to)
              );
              const isSectionPinnedOpen = openSections[section.title] ?? isSectionActive;
              const isSectionHovered = hoveredSection === section.title;
              const isSectionOpen = isSectionPinnedOpen || isSectionHovered;

              return (
                <div
                  key={section.title}
                  className="nav-section"
                  onMouseEnter={() => setHoveredSection(section.title)}
                  onMouseLeave={() => setHoveredSection((current) =>
                    current === section.title ? null : current
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className={
                      isSectionActive || isSectionOpen
                        ? "nav-item nav-item-active nav-toggle"
                        : "nav-item nav-toggle"
                    }
                  >
                    <span>{section.title}</span>
                    <span className="nav-toggle-indicator" aria-hidden="true">
                      {isSectionOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isSectionOpen ? (
                    <div className="nav-submenu">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() =>
                            setHoveredSection((current) =>
                              current === section.title ? null : current
                            )
                          }
                          className={({ isActive }) =>
                            isActive ? "nav-subitem nav-subitem-active" : "nav-subitem"
                          }
                        >
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()
          ))}

          {visibleSections.length === 0 ? (
            <div className="nav-empty-state">
              <strong>Sin módulos habilitados</strong>
              <span>Tu cuenta aún no tiene roles asignados para esta plataforma.</span>
            </div>
          ) : null}
        </nav>

        <div className="user-panel-wrap" ref={userMenuRef}>
          <button
            type="button"
            className="user-panel"
            onClick={() => setIsUserMenuOpen((current) => !current)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
          >
            <div className="user-avatar" aria-hidden="true">
              {userInitials}
            </div>
            <div className="user-meta">
              <strong>{displayName}</strong>
              <span>{email || "Correo no disponible"}</span>
              <small>{jobTitle}</small>
            </div>
          </button>

          {isUserMenuOpen ? (
            <div className="user-menu">
              <div className="user-menu-header">
                <strong>{displayName}</strong>
                <span>{email || "Correo no disponible"}</span>
                <small>{jobTitle}</small>
              </div>

              <button type="button" className="user-menu-action">
                Mi perfil
              </button>
              <button
                type="button"
                className="user-menu-action"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  void signOut();
                }}
              >
                Cerrar sesion
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
