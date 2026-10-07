import { FerrostarCore, SimulatedLocationProvider } from "@stadiamaps/ferrostar-webcomponents";
import type { TripState } from "@stadiamaps/ferrostar";
import { createValhallaHttpClient } from "./ferrostarHttpClient";

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";

/** This module must only be dynamically imported from the driver-navigation action. */
export function createFerrostarCore(onTripStateChange: (state: TripState | null) => void) {
  const core = new FerrostarCore();
  core.valhallaEndpointUrl = VALHALLA_URL;
  core.profile = "auto";
  core.options = {
    costing_options: { auto: { use_ferry: 0, use_tolls: 0.5 } },
    directions_options: { language: "es-ES", units: "kilometers" }
  };
  core.httpClient = createValhallaHttpClient();
  core.onTripStateChange = onTripStateChange;
  return core;
}

export function createSimulatedLocationProvider() {
  const provider = new SimulatedLocationProvider();
  provider.warpFactor = 8;
  return provider;
}
