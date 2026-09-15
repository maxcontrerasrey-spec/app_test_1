import { NavLink, useLocation } from "react-router";
import { homeNavigationItem, type NavigationItem, type NavigationModule } from "../../shared/config/navigation";
import { preloadRouteModulesForPath } from "../router/routeModules";
import { NavigationIcon } from "./NavigationIcon";

type CollapsedNavigationRailProps = {
  modules: NavigationModule[];
  onExpand: () => void;
};

function preloadNavigationPath(path?: string) {
  if (path) {
    void preloadRouteModulesForPath(path);
  }
}

function CollapsedNavigationItems({ items }: { items: NavigationItem[] }) {
  return items.map((item) => (
    <div key={item.to} className="sidebar-icon-rail-item-wrap">
      <NavLink
        to={item.to}
        reloadDocument
        aria-label={item.label}
        title={item.label}
        onMouseEnter={() => preloadNavigationPath(item.to)}
        onFocus={() => preloadNavigationPath(item.to)}
        className={({ isActive }) =>
          isActive
            ? "sidebar-icon-rail-link sidebar-icon-rail-link-active"
            : "sidebar-icon-rail-link"
        }
      >
        <NavigationIcon iconKey={item.iconKey} />
      </NavLink>
      {item.items?.length ? <CollapsedNavigationItems items={item.items} /> : null}
    </div>
  ));
}

export function CollapsedNavigationRail({ modules, onExpand }: CollapsedNavigationRailProps) {
  const location = useLocation();

  return (
    <nav className="sidebar-icon-rail" aria-label="Navegación compacta">
      <NavLink
        to={homeNavigationItem.to}
        end
        reloadDocument
        aria-label={homeNavigationItem.label}
        title={homeNavigationItem.label}
        onMouseEnter={() => preloadNavigationPath(homeNavigationItem.to)}
        onFocus={() => preloadNavigationPath(homeNavigationItem.to)}
        className={({ isActive }) =>
          isActive
            ? "sidebar-icon-rail-link sidebar-icon-rail-link-active"
            : "sidebar-icon-rail-link"
        }
      >
        <NavigationIcon iconKey={homeNavigationItem.iconKey} />
      </NavLink>

      {modules.map((module) =>
        module.items?.length ? (
          <section key={module.label} className="sidebar-icon-rail-group" aria-label={module.label}>
            <button
              type="button"
              className="sidebar-icon-rail-module"
              aria-label={`Mostrar módulo ${module.label}`}
              title={module.label}
              onClick={onExpand}
            >
              <NavigationIcon iconKey={module.iconKey} />
            </button>
            <div className="sidebar-icon-rail-submodules">
              <CollapsedNavigationItems items={module.items} />
            </div>
          </section>
        ) : (
          <NavLink
            key={module.label}
            to={module.to ?? "/"}
            reloadDocument
            aria-label={module.label}
            title={module.label}
            onMouseEnter={() => preloadNavigationPath(module.to)}
            onFocus={() => preloadNavigationPath(module.to)}
            className={({ isActive }) =>
              isActive || Boolean(module.to && location.pathname.startsWith(module.to))
                ? "sidebar-icon-rail-link sidebar-icon-rail-link-active"
                : "sidebar-icon-rail-link"
            }
          >
            <NavigationIcon iconKey={module.iconKey} />
          </NavLink>
        )
      )}
    </nav>
  );
}
