import { FerrostarCore, SimulatedLocationProvider } from "@stadiamaps/ferrostar-webcomponents";
import type { TripState } from "@stadiamaps/ferrostar";
import { createValhallaHttpClient } from "./ferrostarHttpClient";
import { resolveAtlasVehicleRoutingModel } from "./vehicleRoutingCosting";

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";

/** This module must only be dynamically imported from the driver-navigation action. */
export function createFerrostarCore(onTripStateChange: (state: TripState | null) => void, vehicleType: string) {
  const core = new FerrostarCore();
  core.valhallaEndpointUrl = VALHALLA_URL;
  configureFerrostarCore(core, vehicleType);
  core.httpClient = createValhallaHttpClient();
  core.onTripStateChange = onTripStateChange;
  return core;
}

export function configureFerrostarCore(core: FerrostarCore, vehicleType: string) {
  const model = resolveAtlasVehicleRoutingModel(vehicleType);
  const { costing, dimensions } = model;
  core.profile = costing;
  core.options = {
    costing_options: { [costing]: { use_ferry: 0, use_tolls: 0.5, height: dimensions.height, width: dimensions.width, length: dimensions.length, weight: dimensions.weight } },
    directions_options: { language: "es-ES", units: "kilometers" }
  };
}

export function createSimulatedLocationProvider() {
  const provider = new SimulatedLocationProvider();
  provider.warpFactor = 8;
  return provider;
}
