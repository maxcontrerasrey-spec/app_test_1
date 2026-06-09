import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  homeNavigationItem,
  navigationModules,
  type NavigationItem
} from "../../shared/config/navigation";
import logo from "../../assets/app-logo.png";
import { hasModuleAccess } from "../../modules/auth/config/access";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { useTheme } from "../../shared/context/ThemeContext";
import orionLogo from "../../assets/orion-logo.png";
import { ORIONWidget } from "../../modules/ai_assistant/components/ORIONWidget";

function SubmenuIcon({ iconKey }: { iconKey?: NavigationItem["iconKey"] }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (iconKey) {
    case "timeline":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M5 18h14" />
          <path {...commonProps} d="M7 15V9" />
          <path {...commonProps} d="M12 15V6" />
          <path {...commonProps} d="M17 15v-3" />
        </svg>
      );
    case "certificate":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M7 4h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path {...commonProps} d="m9 20 3-2 3 2v-4H9Z" />
          <path {...commonProps} d="M9 8h6" />
        </svg>
      );
    case "tracking":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...commonProps} cx="11" cy="11" r="6" />
          <path {...commonProps} d="m20 20-4.2-4.2" />
          <path {...commonProps} d="M11 8v3l2 1.5" />
        </svg>
      );
    case "document":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M8 4h6l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path {...commonProps} d="M14 4v4h4" />
          <path {...commonProps} d="M9 13h6" />
        </svg>
      );
  }
}

export function AppShell() {
  const location = useLocation();
  const { accessibleModules, displayName, email, isSuperAdmin, jobTitle, signOut } =
    useAuth();
  const { theme, setTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<any>(null);

  const handleMouseEnterModule = (label: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHoveredModule(label);
  };

  const handleMouseLeaveModule = (label: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (pinnedModule !== label) {
        setHoveredModule((current) => (current === label ? null : current));
      }
    }, 150);
  };

  const handleMouseEnterMega = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleMouseLeaveMega = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (!pinnedModule) {
        setHoveredModule(null);
      }
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
  const openModule = visibleModules.find(
    (module) => module.items?.length && module.label === openModuleLabel
  );

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
    clearPinnedNavigation();
  }, [location.pathname]);

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
      <header className="top-shell" ref={navMenuRef}>
        <div className="top-shell-bar">
          <NavLink
            aria-label="Ir al inicio"
            className="top-brand-block"
            to="/"
          >
            <img alt="Logo JM" className="app-logo app-logo-topbar" src={logo} />
          </NavLink>

          <div className="top-nav-stage">
            <nav className="top-nav" aria-label="Modulos">
              <NavLink
                key={homeNavigationItem.to}
                to={homeNavigationItem.to}
                end
                className={({ isActive }) =>
                  isActive ? "top-nav-link top-nav-link-active" : "top-nav-link"
                }
              >
                <span>{homeNavigationItem.label}</span>
              </NavLink>

              {isSuperAdmin ? (
                <NavLink
                  to="/copiloto-ia"
                  className={({ isActive }) =>
                    isActive ? "top-nav-link top-nav-link-active" : "top-nav-link"
                  }
                  style={{ display: "flex", gap: "6px", alignItems: "center" }}
                >
                  <img src={orionLogo} alt="ORION" style={{ width: "24px", height: "24px", objectFit: "contain" }} className="orion-nav-icon" />
                  <span>ORION</span>
                </NavLink>
              ) : null}

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
                      end
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
                    onMouseEnter={() => handleMouseEnterModule(module.label)}
                    onMouseLeave={() => handleMouseLeaveModule(module.label)}
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

                  </div>
                );
              })}
            </nav>
          </div>

          <div className="top-shell-right">
            <div className="top-nav-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Alternar tema oscuro"
              title="Cambiar a modo oscuro o claro"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
          </div>

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
        </div>

        {openModule?.items?.length ? (
          <div
            className="top-nav-mega-shell"
            onMouseEnter={handleMouseEnterMega}
            onMouseLeave={handleMouseLeaveMega}
          >
            <div className="top-nav-mega-panel">
              <div className="top-nav-mega-grid">
                {openModule.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={clearPinnedNavigation}
                    className={({ isActive }) =>
                      isActive
                        ? "top-nav-mega-link top-nav-mega-link-active"
                        : "top-nav-mega-link"
                    }
                  >
                    <span className="top-nav-mega-icon">
                      <SubmenuIcon iconKey={item.iconKey} />
                    </span>
                    <span className="top-nav-mega-copy">
                      <strong>{item.label}</strong>
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="main-content main-content-topnav">
        <Outlet />
      </main>

      {isSuperAdmin ? <ORIONWidget /> : null}
    </div>
  );
}
