import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { homeNavigationItem, navigationModules } from "../../shared/config/navigation";
import logo from "../../assets/app-logo.png";
import { hasModuleAccess } from "../../modules/auth/config/access";
import { useAuth } from "../../modules/auth/context/AuthContext";

export function AppShell() {
  const location = useLocation();
  const { accessibleModules, displayName, email, isSuperAdmin, jobTitle, signOut } =
    useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleModules = useMemo(
    () =>
      navigationModules
        .map((module) => {
          if (module.items?.length) {
            const visibleItems = module.items.filter(
              (item) => isSuperAdmin || hasModuleAccess(accessibleModules, item.moduleCode)
            );

            return visibleItems.length > 0 ? { ...module, items: visibleItems } : null;
          }

          if (!module.moduleCode) {
            return null;
          }

          return isSuperAdmin || hasModuleAccess(accessibleModules, module.moduleCode)
            ? module
            : null;
        })
        .filter((module): module is NonNullable<typeof module> => module !== null),
    [accessibleModules, isSuperAdmin]
  );

  const openModuleLabel = pinnedModule ?? hoveredModule;

  const clearPinnedNavigation = () => {
    setHoveredModule(null);
    setPinnedModule(null);
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
    if (!isUserMenuOpen && !pinnedModule) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (isUserMenuOpen && !userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }

      if (pinnedModule && !navMenuRef.current?.contains(event.target as Node)) {
        clearPinnedNavigation();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isUserMenuOpen, pinnedModule]);

  return (
    <div className="app-shell app-shell-topnav">
      <header className="top-shell">
        <div className="top-shell-bar">
          <NavLink
            aria-label="Ir al inicio"
            className="top-brand-block"
            to="/"
            onClick={clearPinnedNavigation}
          >
            <img alt="Logo JM" className="app-logo app-logo-topbar" src={logo} />
          </NavLink>

          <nav className="top-nav" aria-label="Modulos" ref={navMenuRef}>
            <NavLink
              key={homeNavigationItem.to}
              to={homeNavigationItem.to}
              onClick={clearPinnedNavigation}
              className={({ isActive }) =>
                isActive ? "top-nav-link top-nav-link-active" : "top-nav-link"
              }
            >
              <span>{homeNavigationItem.label}</span>
            </NavLink>

            {visibleModules.map((module) => {
              const hasChildren = Boolean(module.items?.length);
              const isModuleActive = hasChildren
                ? module.items?.some((item) => location.pathname.startsWith(item.to))
                : Boolean(module.to && location.pathname.startsWith(module.to));
              const isModuleOpen = openModuleLabel === module.label && hasChildren;

              if (!hasChildren || !module.items) {
                return (
                  <NavLink
                    key={module.label}
                    to={module.to ?? "/"}
                    onClick={clearPinnedNavigation}
                    className={({ isActive }) =>
                      isActive || isModuleActive
                        ? "top-nav-link top-nav-link-active"
                        : "top-nav-link"
                    }
                  >
                    <span>{module.label}</span>
                  </NavLink>
                );
              }

              return (
                <div
                  key={module.label}
                  className="top-nav-group"
                  onMouseEnter={() => setHoveredModule(module.label)}
                  onMouseLeave={() => {
                    if (pinnedModule !== module.label) {
                      setHoveredModule((current) =>
                        current === module.label ? null : current
                      );
                    }
                  }}
                >
                  <button
                    type="button"
                    className={
                      isModuleActive || isModuleOpen
                        ? "top-nav-link top-nav-link-active top-nav-toggle"
                        : "top-nav-link top-nav-toggle"
                    }
                    onClick={() =>
                      setPinnedModule((current) => {
                        const nextPinned = current === module.label ? null : module.label;
                        setHoveredModule(nextPinned);
                        return nextPinned;
                      })
                    }
                    aria-expanded={isModuleOpen}
                  >
                    <span>{module.label}</span>
                    <span className="top-nav-indicator" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {isModuleOpen ? (
                    <div className="top-nav-flyout">
                      {module.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={clearPinnedNavigation}
                          className={({ isActive }) =>
                            isActive
                              ? "top-nav-flyout-link top-nav-flyout-link-active"
                              : "top-nav-flyout-link"
                          }
                        >
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="top-user-panel-wrap" ref={userMenuRef}>
            <button
              type="button"
              className="top-user-panel"
              onClick={() => setIsUserMenuOpen((current) => !current)}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
            >
              <div className="user-avatar" aria-hidden="true">
                {userInitials}
              </div>
              <div className="top-user-meta">
                <strong>{displayName}</strong>
                <span>{jobTitle}</span>
              </div>
            </button>

            {isUserMenuOpen ? (
              <div className="user-menu top-user-menu">
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
        </div>
      </header>

      <main className="main-content main-content-topnav">
        <Outlet />
      </main>
    </div>
  );
}
