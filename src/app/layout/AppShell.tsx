import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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

  switch (iconKey as any) {
    case "flask":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a2.5 2.5 0 0 0 2.227 3.45h10.106a2.5 2.5 0 0 0 2.227-3.45l-5.068-10.127A2 2 0 0 1 14 9.527V2" />
          <path {...commonProps} d="M8.5 2h7" />
          <path {...commonProps} d="M14 16H5.3" />
        </svg>
      );
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
  const navigate = useNavigate();
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
          if (module.adminOnly && !isSuperAdmin) {
            return null;
          }
          
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
              onClick={() => {
                const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "e-ink" : "light";
                setTheme(nextTheme);
              }}
              aria-label="Alternar tema"
              title="Cambiar entre Claro, Oscuro y Tinta Electrónica"
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
              ) : theme === "e-ink" ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
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
                    navigate("/reset-password", { state: { voluntaryChange: true } });
                  }}
                >
                  Cambiar contraseña
                </button>
                <button
                  type="button"
                  className="user-menu-action"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void signOut();
                  }}
                >
                  Cerrar sesión
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
                  <div key={item.label} className="top-nav-mega-item-wrapper" style={{ position: 'static' }}>
                    <NavLink
                      to={item.to || "#"}
                      onClick={(e) => {
                        if (item.items && item.items.length > 0) {
                          e.preventDefault();
                        } else {
                          clearPinnedNavigation();
                        }
                      }}
                      className={({ isActive }) =>
                        isActive && !item.items
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

                      {item.items && item.items.length > 0 && (
                        <span className="top-nav-indicator" style={{ marginLeft: "auto", fontSize: "0.8rem" }}>
                          ▾
                        </span>
                      )}
                    </NavLink>

                    {item.items && item.items.length > 0 && (
                      <div className="top-nav-third-tray">
                        {item.items.map((subItem) => (
                          <NavLink
                            key={subItem.to}
                            to={subItem.to}
                            onClick={(e) => {
                              e.stopPropagation();
                              clearPinnedNavigation();
                            }}
                            className="top-nav-third-link"
                          >
                            <span className="top-nav-mega-icon" style={{ width: "1.5rem", height: "1.5rem" }}>
                              <SubmenuIcon iconKey={subItem.iconKey} />
                            </span>
                            <strong>{subItem.label}</strong>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
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
