import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { preloadRouteModulesForPath } from "../router/routeModules";
import {
  homeNavigationItem,
  navigationModules,
  type NavigationItem
} from "../../shared/config/navigation";
import logo from "../../assets/app-logo.png";
import { hasModuleAccess } from "../../modules/auth/config/access";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { AupPolicyModal } from "../../modules/auth/components/AupPolicyModal";
import { useDashboard } from "../../modules/dashboard/hooks/useDashboard";
import { canViewHrIncentiveAnalytics } from "../../modules/incentives/lib/analyticsAccess";
import { useTheme } from "../../shared/context/ThemeContext";
import orionLogo from "../../assets/orion-logo.png";
import { lazyWithRetry } from "../../shared/lib/lazyWithRetry";
import { TopNotificationsMenu } from "./TopNotificationsMenu";

const ORIONWidget = lazyWithRetry("orion-widget", async () => {
  const module = await import("../../modules/ai_assistant/components/ORIONWidget");
  return { default: module.ORIONWidget };
});

function SubmenuIcon({ iconKey }: { iconKey?: NavigationItem["iconKey"] }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (iconKey) {
    case "user-plus":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle {...commonProps} cx="9" cy="7" r="4" />
          <line {...commonProps} x1="19" x2="19" y1="8" y2="14" />
          <line {...commonProps} x1="22" x2="16" y1="11" y2="11" />
        </svg>
      );
    case "arrow-right-left":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="m16 3 4 4-4 4" />
          <path {...commonProps} d="M20 7H4" />
          <path {...commonProps} d="m8 21-4-4 4-4" />
          <path {...commonProps} d="M4 17h16" />
        </svg>
      );
    case "clipboard-list":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...commonProps} width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path {...commonProps} d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path {...commonProps} d="M12 11h4" />
          <path {...commonProps} d="M12 16h4" />
          <path {...commonProps} d="M8 11h.01" />
          <path {...commonProps} d="M8 16h.01" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line {...commonProps} x1="12" x2="12" y1="20" y2="10" />
          <line {...commonProps} x1="18" x2="18" y1="20" y2="4" />
          <line {...commonProps} x1="6" x2="6" y1="20" y2="16" />
        </svg>
      );
    case "briefcase":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <rect {...commonProps} width="20" height="14" x="2" y="6" rx="2" />
        </svg>
      );
    case "zap":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon {...commonProps} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "download":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline {...commonProps} points="7 10 12 15 17 10" />
          <line {...commonProps} x1="12" x2="12" y1="15" y2="3" />
        </svg>
      );
    case "calendar-clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
          <path {...commonProps} d="M16 2v4" />
          <path {...commonProps} d="M8 2v4" />
          <path {...commonProps} d="M3 10h5" />
          <path {...commonProps} d="M17.5 17.5 16 16.3V14" />
          <circle {...commonProps} cx="16" cy="16" r="6" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path {...commonProps} d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      );
    case "trending-up":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline {...commonProps} points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline {...commonProps} points="16 7 22 7 22 13" />
        </svg>
      );
    case "badge-check":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...commonProps} d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <path {...commonProps} d="m9 12 2 2 4-4" />
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

function collectNavigationPaths(items: NavigationItem[] = []): string[] {
  return items.flatMap((item) =>
    item.items?.length ? [item.to, ...collectNavigationPaths(item.items)] : [item.to]
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessibleModules, appRoles, displayName, email, isSuperAdmin, jobTitle, profile, signOut } =
    useAuth();
  const { tasksData } = useDashboard();
  const { theme, setTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);
  const [hoveredMegaItem, setHoveredMegaItem] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const thirdTrayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnterMegaItem = (label: string) => {
    if (thirdTrayTimerRef.current) clearTimeout(thirdTrayTimerRef.current);
    setHoveredMegaItem(label);
  };

  const handleMouseLeaveMegaItem = () => {
    thirdTrayTimerRef.current = setTimeout(() => {
      setHoveredMegaItem(null);
    }, 100);
  };
  const navMenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (thirdTrayTimerRef.current) {
        clearTimeout(thirdTrayTimerRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isItemVisible = (item: NavigationItem) => {
    const hasExplicitRoleScope = Boolean(item.visibleForRoles?.length);
    const roleAllowed =
      !hasExplicitRoleScope || item.visibleForRoles?.some((role) => appRoles.includes(role));
    const moduleAllowed = isSuperAdmin || hasModuleAccess(accessibleModules, item.moduleCode);
    const analyticsAllowed =
      hasExplicitRoleScope &&
      item.moduleCode === "recursos_humanos" &&
      canViewHrIncentiveAnalytics({ appRoles, isSuperAdmin });

    if (item.items?.length) {
      const visibleChildren = item.items.filter(isItemVisible);
      return roleAllowed && visibleChildren.length > 0;
    }

    return roleAllowed && (moduleAllowed || analyticsAllowed);
  };

  const visibleModules = useMemo(
    () =>
      navigationModules
        .map((module) => {
          const roleAllowed =
            !module.visibleForRoles?.length ||
            module.visibleForRoles.some((role) => appRoles.includes(role));

          if (!roleAllowed) {
            return null;
          }

          if (module.items?.length) {
            const visibleItems = module.items
              .map((item) => {
                if (!isItemVisible(item)) {
                  return null;
                }

                if (!item.items?.length) {
                  return item;
                }

                const visibleSubItems = item.items.filter(isItemVisible);
                return visibleSubItems.length > 0 ? { ...item, items: visibleSubItems } : null;
              })
              .filter((item): item is NonNullable<typeof item> => item !== null);

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
    [accessibleModules, appRoles, isSuperAdmin]
  );

  const openModuleLabel = pinnedModule ?? hoveredModule;
  const openModule = visibleModules.find(
    (module) => module.items?.length && module.label === openModuleLabel
  );

  const clearPinnedNavigation = () => {
    setHoveredModule(null);
    setPinnedModule(null);
  };
  const preloadNavigationPath = (path?: string) => {
    if (!path) {
      return;
    }

    void preloadRouteModulesForPath(path);
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
    if (!isUserMenuOpen && !isNotificationsOpen && !pinnedModule) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (isUserMenuOpen && !userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }

      if (isNotificationsOpen && !notificationsMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }

      if (pinnedModule && !navMenuRef.current?.contains(event.target as Node)) {
        clearPinnedNavigation();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isUserMenuOpen, isNotificationsOpen, pinnedModule]);

  useEffect(() => {
    const pathsToWarm = new Set<string>([
      homeNavigationItem.to,
      ...visibleModules.flatMap((module) =>
        module.items?.length ? collectNavigationPaths(module.items) : module.to ? [module.to] : []
      )
    ]);

    const warmVisibleRoutes = () => {
      pathsToWarm.forEach((path) => preloadNavigationPath(path));
    };

    if (typeof window === "undefined") {
      return;
    }

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => {
        warmVisibleRoutes();
      }, { timeout: 2500 });

      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => {
      warmVisibleRoutes();
    }, 1200);

    return () => globalThis.clearTimeout(timeoutId);
  }, [visibleModules]);

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
                onMouseEnter={() => preloadNavigationPath(homeNavigationItem.to)}
                onFocus={() => preloadNavigationPath(homeNavigationItem.to)}
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
                      end
                      onMouseEnter={() => preloadNavigationPath(module.to)}
                      onFocus={() => preloadNavigationPath(module.to)}
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
                    onMouseEnter={() => {
                      handleMouseEnterModule(module.label);
                      module.items?.forEach((item) => preloadNavigationPath(item.to));
                    }}
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

              {isSuperAdmin ? (
                <NavLink
                  to="/copiloto-ia"
                  onMouseEnter={() => preloadNavigationPath("/copiloto-ia")}
                  onFocus={() => preloadNavigationPath("/copiloto-ia")}
                  className={({ isActive }) =>
                    isActive ? "top-nav-link top-nav-link-active" : "top-nav-link"
                  }
                  style={{ display: "flex", gap: "6px", alignItems: "center" }}
                >
                  <img src={orionLogo} alt="ORION" style={{ width: "24px", height: "24px", objectFit: "contain" }} className="orion-nav-icon" />
                  <span>ORION</span>
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className="top-shell-right">
            <div className="top-nav-actions">
            <TopNotificationsMenu
              isOpen={isNotificationsOpen}
              onToggle={() => setIsNotificationsOpen((current) => !current)}
              onClose={() => setIsNotificationsOpen(false)}
              tasks={tasksData}
              containerRef={notificationsMenuRef}
            />
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
              <div className="top-user-meta">
                <strong>{displayName}</strong>
                <span>{jobTitle || appRoles[0] || "Usuario activo"}</span>
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
                  <div 
                    key={item.label} 
                    className="top-nav-mega-item-wrapper"
                    onMouseEnter={() => handleMouseEnterMegaItem(item.label)}
                    onMouseLeave={() => handleMouseLeaveMegaItem()}
                  >
                    <NavLink
                      to={item.to || "#"}
                      onMouseEnter={() => preloadNavigationPath(item.to)}
                      onFocus={() => preloadNavigationPath(item.to)}
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
                  </div>
                ))}
              </div>

              {/* Render third trays outside the grid to guarantee full width */}
              {openModule.items.map((item) => {
                if (!item.items || item.items.length === 0) return null;
                return (
                  <div
                    key={`${item.label}-tray`}
                    className={`top-nav-third-tray ${hoveredMegaItem === item.label ? 'is-visible' : ''}`}
                    onMouseEnter={() => handleMouseEnterMegaItem(item.label)}
                    onMouseLeave={() => handleMouseLeaveMegaItem()}
                  >
                    <div className="top-nav-third-content">
                      {item.items.map((subItem) => (
                        <NavLink
                          key={subItem.to}
                          to={subItem.to}
                          onMouseEnter={() => preloadNavigationPath(subItem.to)}
                          onFocus={() => preloadNavigationPath(subItem.to)}
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
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <main className="main-content main-content-topnav">
        <Outlet />
      </main>

      {isSuperAdmin ? (
        <Suspense fallback={null}>
          <ORIONWidget />
        </Suspense>
      ) : null}
      {profile && !profile.aup_accepted_at ? <AupPolicyModal /> : null}
    </div>
  );
}
