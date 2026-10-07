declare module "@stadiamaps/ferrostar-webcomponents" {
  import type { Route, TripState, UserLocation, Waypoint } from "@stadiamaps/ferrostar";
  import type { Map as MapLibreMap } from "maplibre-gl";

  export class FerrostarCore extends HTMLElement {
    valhallaEndpointUrl: string;
    profile: string;
    options: object;
    httpClient?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    locationProvider: SimulatedLocationProvider | null;
    onTripStateChange?: (tripState: TripState | null) => void;
    getRoutes(initialLocation: UserLocation, waypoints: Waypoint[]): Promise<Route[]>;
    startNavigation(route: Route, config: object): void;
    stopNavigation(): Promise<void>;
  }

  export class FerrostarMap extends HTMLElement {
    map: MapLibreMap;
    route: Route | null;
    system: "metric" | "imperial" | "imperialWithYards";
    addGeolocateControl: boolean;
    geolocateOnLoad: boolean;
    linkWith(stateProvider: FerrostarCore, showUserMarker?: boolean): void;
  }

  export class SimulatedLocationProvider {
    warpFactor: number;
    setSimulatedRoute(route: Route): void;
    stop(): void;
  }
}
