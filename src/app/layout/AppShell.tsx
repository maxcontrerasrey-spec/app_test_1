import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { homeNavigationItem, navigationSections } from "../../shared/config/navigation";
import logo from "../../assets/app-logo.png";

export function AppShell() {
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
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
    setOpenSections(
      Object.fromEntries(navigationSections.map((section) => [section.title, false]))
    );
  };

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

          {navigationSections.map((section) => (
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
        </nav>

        <div
          className="user-panel-wrap"
          onMouseEnter={() => setIsUserMenuOpen(true)}
          onMouseLeave={() => setIsUserMenuOpen(false)}
        >
          <button
            type="button"
            className="user-panel"
            onClick={() => setIsUserMenuOpen((current) => !current)}
          >
            <div className="user-avatar" aria-hidden="true">
              MC
            </div>
            <div className="user-meta">
              <strong>Maximiliano Contreras</strong>
              <span>max.contreras@empresa.com</span>
              <small>Acceso Microsoft 365</small>
            </div>
          </button>

          {isUserMenuOpen ? (
            <div className="user-menu">
              <div className="user-menu-header">
                <strong>Maximiliano Contreras</strong>
                <span>max.contreras@empresa.com</span>
                <small>Acceso Microsoft 365</small>
              </div>

              <button type="button" className="user-menu-action">
                Mi perfil
              </button>
              <button type="button" className="user-menu-action">
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
