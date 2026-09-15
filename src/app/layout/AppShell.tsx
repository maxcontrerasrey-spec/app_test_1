import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { preloadRouteModulesForPath } from "../router/routeModules";
import {
  homeNavigationItem,
  navigationModules,
  type NavigationIconKey,
  type NavigationItem
} from "../../shared/config/navigation";
import nexusMark from "../../assets/nexus-mark.png";
import { hasModuleAccess } from "../../modules/auth/config/access";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { AupPolicyModal } from "../../modules/auth/components/AupPolicyModal";
import { useDashboard } from "../../modules/dashboard/hooks/useDashboard";
import { canViewHrIncentiveAnalytics } from "../../modules/incentives/lib/analyticsAccess";
import { useTheme } from "../../shared/context/ThemeContext";
import { TopNotificationsMenu } from "./TopNotificationsMenu";
import { NavigationIcon } from "./NavigationIcon";

type WorkspaceSearchDestination = {
  id: string;
  label: string;
  moduleLabel: string;
  description: string;
  to: string;
  iconKey?: NavigationIconKey;
};

function SidebarToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}

function collectNavigationPaths(items: NavigationItem[] = []): string[] {
  return items.flatMap((item) =>
    item.items?.length ? [item.to, ...collectNavigationPaths(item.items)] : [item.to]
  );
}

function navigationItemContainsPath(item: NavigationItem, pathname: string): boolean {
  return (
    pathname === item.to ||
    pathname.startsWith(`${item.to}/`) ||
    Boolean(item.items?.some((child) => navigationItemContainsPath(child, pathname)))
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
  const [isWorkspaceSearchOpen, setIsWorkspaceSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("nexus-sidebar-collapsed") === "true";
  });
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);
  const [hoveredMegaItem, setHoveredMegaItem] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const workspaceSearchRef = useRef<HTMLDivElement>(null);
  const workspaceSearchInputRef = useRef<HTMLInputElement>(null);
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

  const workspaceSearchDestinations = useMemo(() => {
    const destinations = new Map<string, WorkspaceSearchDestination>();
    destinations.set(homeNavigationItem.to, {
      id: "workspace-search-home",
      label: homeNavigationItem.label,
      moduleLabel: "Inicio",
      description: "Resumen operativo, indicadores y tareas pendientes.",
      to: homeNavigationItem.to,
      iconKey: homeNavigationItem.iconKey
    });

    const addItems = (items: NavigationItem[], moduleLabel: string) => {
      items.forEach((item) => {
        destinations.set(item.to, {
          id: `workspace-search-${item.moduleCode}-${item.to}`,
          label: item.label,
          moduleLabel,
          description: item.description ?? `Ir a ${item.label}.`,
          to: item.to,
          iconKey: item.iconKey
        });

        if (item.items?.length) {
          addItems(item.items, moduleLabel);
        }
      });
    };

    visibleModules.forEach((module) => {
      if (module.items?.length) {
        addItems(module.items, module.label);
        return;
      }

      if (module.to) {
        destinations.set(module.to, {
          id: `workspace-search-${module.moduleCode ?? module.label}`,
          label: "Dashboard",
          moduleLabel: module.label,
          description: `Indicadores y análisis de ${module.label}.`,
          to: module.to,
          iconKey: module.iconKey
        });
      }
    });

    return Array.from(destinations.values());
  }, [visibleModules]);

  const workspaceSearchResults = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(workspaceSearchQuery);
    if (!normalizedQuery) {
      return workspaceSearchDestinations.slice(0, 7);
    }

    return workspaceSearchDestinations
      .map((destination) => {
        const label = normalizeSearchValue(destination.label);
        const moduleLabel = normalizeSearchValue(destination.moduleLabel);
        const description = normalizeSearchValue(destination.description);
        const route = normalizeSearchValue(destination.to.replace(/\//g, " "));
        const searchableValue = `${label} ${moduleLabel} ${description} ${route}`;

        if (!searchableValue.includes(normalizedQuery)) {
          return null;
        }

        const score = label.startsWith(normalizedQuery)
          ? 0
          : label.includes(normalizedQuery)
            ? 1
            : moduleLabel.includes(normalizedQuery)
              ? 2
              : 3;

        return { destination, score };
      })
      .filter((result): result is { destination: WorkspaceSearchDestination; score: number } => Boolean(result))
      .sort((left, right) => left.score - right.score || left.destination.label.localeCompare(right.destination.label, "es-CL"))
      .slice(0, 7)
      .map(({ destination }) => destination);
  }, [workspaceSearchDestinations, workspaceSearchQuery]);

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
    setIsWorkspaceSearchOpen(false);
    setWorkspaceSearchQuery("");
  }, [location.pathname]);

  useEffect(() => {
    window.localStorage.setItem("nexus-sidebar-collapsed", String(isSidebarCollapsed));
    if (isSidebarCollapsed) {
      clearPinnedNavigation();
      setIsNotificationsOpen(false);
      setIsUserMenuOpen(false);
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setActiveSearchResultIndex(0);
  }, [workspaceSearchQuery, workspaceSearchDestinations]);

  useEffect(() => {
    const handleWorkspaceSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("es-CL") === "k") {
        event.preventDefault();
        setIsWorkspaceSearchOpen(true);
        workspaceSearchInputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleWorkspaceSearchShortcut);
    return () => document.removeEventListener("keydown", handleWorkspaceSearchShortcut);
  }, []);

  useEffect(() => {
    if (!isWorkspaceSearchOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!workspaceSearchRef.current?.contains(event.target as Node)) {
        setIsWorkspaceSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isWorkspaceSearchOpen]);

  const openSearchDestination = (destination: WorkspaceSearchDestination) => {
    preloadNavigationPath(destination.to);
    setIsWorkspaceSearchOpen(false);
    setWorkspaceSearchQuery("");
    navigate(destination.to);
  };

  const handleWorkspaceSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsWorkspaceSearchOpen(false);
      workspaceSearchInputRef.current?.blur();
      return;
    }

    if (workspaceSearchResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchResultIndex((current) => (current + 1) % workspaceSearchResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchResultIndex((current) =>
        current === 0 ? workspaceSearchResults.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      openSearchDestination(workspaceSearchResults[activeSearchResultIndex] ?? workspaceSearchResults[0]);
    }
  };

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

  const renderNavigationDropdownItems = (items: NavigationItem[]) =>
    items.map((item) => (
      <div key={item.label} className="top-nav-dropdown-item-wrap">
        <NavLink
          to={item.to || "#"}
          reloadDocument
          onMouseEnter={() => preloadNavigationPath(item.to)}
          onFocus={() => preloadNavigationPath(item.to)}
          onClick={() => {
            if (!item.items || item.items.length === 0) {
              clearPinnedNavigation();
            }
          }}
          className={({ isActive }) =>
            isActive && !item.items
              ? "top-nav-dropdown-link top-nav-dropdown-link-active"
              : "top-nav-dropdown-link"
          }
        >
          <span className="top-nav-dropdown-icon">
            <NavigationIcon iconKey={item.iconKey} />
          </span>
          <span>{item.label}</span>
          {item.items && item.items.length > 0 && (
            <span className="top-nav-dropdown-arrow" aria-hidden="true">
              ›
            </span>
          )}
        </NavLink>
        {item.items && item.items.length > 0 && (
          <div className="top-nav-dropdown-subpanel">
            {item.items.map((subItem) => (
              <NavLink
                key={subItem.label}
                to={subItem.to}
                reloadDocument
                onMouseEnter={() => preloadNavigationPath(subItem.to)}
                onFocus={() => preloadNavigationPath(subItem.to)}
                onClick={() => clearPinnedNavigation()}
                className={({ isActive }) =>
                  isActive
                    ? "top-nav-dropdown-link top-nav-dropdown-link-active"
                    : "top-nav-dropdown-link"
                }
              >
                <span className="top-nav-dropdown-icon">
                  <NavigationIcon iconKey={subItem.iconKey} />
                </span>
                <span>{subItem.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    ));

  const renderSidebarModules = (modules: typeof visibleModules) =>
    modules.map((module) => {
      const isActive = Boolean(module.items?.some((item) => navigationItemContainsPath(item, location.pathname)));
      return (
        <details
          key={module.label}
          className="sidebar-module-group"
          open={isActive}
        >
          <summary className="sidebar-section-toggle">
            <span className="sidebar-section-heading">
              <span className="sidebar-section-icon" aria-hidden="true">
                <NavigationIcon iconKey={module.iconKey} />
              </span>
              <span className="sidebar-section-label">{module.label}</span>
            </span>
            <span className="sidebar-section-chevron" aria-hidden="true">⌄</span>
          </summary>
          {module.items?.length ? (
            <div className="sidebar-module-items">{renderNavigationDropdownItems(module.items)}</div>
          ) : (
            <NavLink
              to={module.to ?? "/"}
              end
              reloadDocument
              onMouseEnter={() => preloadNavigationPath(module.to)}
              onFocus={() => preloadNavigationPath(module.to)}
              className={({ isActive }) =>
                isActive || (module.to && location.pathname.startsWith(module.to))
                  ? "top-nav-link top-nav-link-active"
                  : "top-nav-link"
              }
            >
              <span className="top-nav-icon" aria-hidden="true">
                <NavigationIcon iconKey="trending-up" />
              </span>
              <span>Dashboard</span>
            </NavLink>
          )}
        </details>
      );
    });

  return (
    <div className={isSidebarCollapsed
      ? "app-shell app-shell-topnav app-shell-sidebar-collapsed"
      : "app-shell app-shell-topnav"}>
      <header
        id="erp-sidebar"
        className={openModule ? "top-shell top-shell--nav-open" : "top-shell"}
        ref={navMenuRef}
      >
        <div className="top-shell-bar">
          <NavLink
            aria-label="Ir al inicio"
            className="top-brand-block"
            to="/"
            reloadDocument
          >
            <img alt="Logo Nexus" className="app-logo app-logo-topbar" src={nexusMark} />
          </NavLink>

          <div className="top-nav-stage">
            <nav className="top-nav" aria-label="Módulos">
              <span className="sidebar-section-label">Inicio</span>
              <NavLink
                key={homeNavigationItem.to}
                to={homeNavigationItem.to}
                end
                reloadDocument
                onMouseEnter={() => preloadNavigationPath(homeNavigationItem.to)}
                onFocus={() => preloadNavigationPath(homeNavigationItem.to)}
                className={({ isActive }) =>
                  isActive ? "top-nav-link top-nav-link-active" : "top-nav-link"
                }
              >
                <span className="top-nav-icon" aria-hidden="true">
                  <NavigationIcon iconKey={homeNavigationItem.iconKey} />
                </span>
                <span>{homeNavigationItem.label}</span>
              </NavLink>
              {renderSidebarModules(visibleModules)}

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
              className="top-user-panel top-user-panel-compact"
              onClick={() => setIsUserMenuOpen((current) => !current)}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              title={`${displayName} - ${jobTitle || "Usuario activo"}`}
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

        {openModule?.items && openModule.items.length > 0 ? (
          <div className="top-nav-mobile-panel" aria-label={`Opciones de ${openModule.label}`}>
            {renderNavigationDropdownItems(openModule.items)}
          </div>
        ) : null}
      </header>

      <main className="main-content main-content-topnav">
        <div className="workspace-header">
          <div className="workspace-leading">
            <button
              type="button"
              className="workspace-sidebar-toggle"
              aria-controls="erp-sidebar"
              aria-expanded={!isSidebarCollapsed}
              aria-label={isSidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              title={isSidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              <SidebarToggleIcon />
            </button>
            <span className="workspace-leading-divider" aria-hidden="true" />
            <div className="workspace-breadcrumb" aria-label="Ruta actual">
              <span>Inicio</span>
              <span aria-hidden="true">›</span>
              <strong>Centro de control</strong>
            </div>
          </div>
          <div className="workspace-search-shell" ref={workspaceSearchRef}>
            <label className="workspace-search">
              <span aria-hidden="true">⌕</span>
              <input
                ref={workspaceSearchInputRef}
                type="search"
                placeholder="Buscar módulos y funciones..."
                aria-label="Buscar en el ERP"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="workspace-search-results"
                aria-expanded={isWorkspaceSearchOpen}
                aria-activedescendant={workspaceSearchResults[activeSearchResultIndex]?.id}
                value={workspaceSearchQuery}
                onFocus={() => setIsWorkspaceSearchOpen(true)}
                onChange={(event) => {
                  setWorkspaceSearchQuery(event.target.value);
                  setIsWorkspaceSearchOpen(true);
                }}
                onKeyDown={handleWorkspaceSearchKeyDown}
              />
              <kbd>⌘ K</kbd>
            </label>
            {isWorkspaceSearchOpen ? (
              <div className="workspace-search-results" id="workspace-search-results" role="listbox">
                <span className="workspace-search-results-label">
                  {workspaceSearchQuery.trim() ? "Destinos recomendados" : "Accesos disponibles"}
                </span>
                {workspaceSearchResults.length > 0 ? (
                  workspaceSearchResults.map((destination, index) => (
                    <button
                      key={destination.to}
                      id={destination.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeSearchResultIndex}
                      className={index === activeSearchResultIndex
                        ? "workspace-search-result workspace-search-result-active"
                        : "workspace-search-result"}
                      onMouseEnter={() => setActiveSearchResultIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openSearchDestination(destination)}
                    >
                      <span className="workspace-search-result-icon" aria-hidden="true">
                        <NavigationIcon iconKey={destination.iconKey} />
                      </span>
                      <span className="workspace-search-result-copy">
                        <strong>{destination.label}</strong>
                        <small>{destination.description}</small>
                      </span>
                      <span className="workspace-search-result-module">{destination.moduleLabel}</span>
                    </button>
                  ))
                ) : (
                  <span className="workspace-search-empty">
                    No hay destinos autorizados que coincidan con la búsqueda.
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <span className="workspace-header-spacer" aria-hidden="true" />
        </div>
        <Outlet />
      </main>

      {profile && !profile.aup_accepted_at ? <AupPolicyModal /> : null}
    </div>
  );
}
