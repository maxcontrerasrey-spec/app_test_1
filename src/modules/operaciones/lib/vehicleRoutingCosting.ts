export const ATLAS_ROUTE_VEHICLE_CATEGORIES = ["Bus", "Taxibus", "Minibus"] as const;
export type AtlasRouteVehicleCategory = typeof ATLAS_ROUTE_VEHICLE_CATEGORIES[number];
export type AtlasValhallaCosting = "bus";

export type AtlasVehicleRoutingModel = {
  category: AtlasRouteVehicleCategory;
  displayName: string;
  model: string;
  costing: AtlasValhallaCosting;
  /** Reference dimensions for routing; they are not a verified profile for each fleet unit. */
  dimensions: { length: number; width: number; height: number; weight: number };
  dimensionEvidence: string;
};

const ROUTING_MODELS: Record<AtlasRouteVehicleCategory, AtlasVehicleRoutingModel> = {
  Bus: {
    category: "Bus",
    displayName: "Mercedes-Benz O 500 RS",
    model: "O 500 RS 2045 · carrozado de referencia 13,2 m × 2,6 m",
    costing: "bus",
    dimensions: { length: 13.2, width: 2.6, height: 4, weight: 20 },
    dimensionEvidence: "Longitud/ancho/radio de giro y PBV de la ficha O 500 RS 2045/30; altura de referencia operativa, no publicada para la carrocería."
  },
  Taxibus: {
    category: "Taxibus",
    displayName: "Mercedes-Benz LO 916",
    model: "LO 916 · largo carrozado máximo 9,2 m",
    costing: "bus",
    dimensions: { length: 9.2, width: 2.4, height: 3.5, weight: 9.4 },
    dimensionEvidence: "Largo carrozado máximo y PBV de la ficha LO 916; ancho/altura son envolventes de referencia, no dimensiones carrozadas verificadas."
  },
  Minibus: {
    category: "Minibus",
    displayName: "Mercedes-Benz Sprinter 517",
    model: "Sprinter Pasaje 517 CDI 19+1 · 4×2 AT",
    costing: "bus",
    dimensions: { length: 7.367, width: 2.02, height: 2.874, weight: 5 },
    dimensionEvidence: "Referencia Sprinter Pasaje 517 CDI 19+1. Largo/ancho/altura corresponden a la variante extra larga/techo alto; confirmar contra la unidad de flota."
  }
};

function normalizedVehicleType(vehicleType: string) {
  return vehicleType.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es-CL").replace(/[^A-Z0-9]/g, "");
}

/** Canonicalizes historical fleet labels to the three categories used by route planning. */
export function resolveAtlasRouteVehicleCategory(vehicleType: string | null | undefined): AtlasRouteVehicleCategory | null {
  if (!vehicleType?.trim()) return null;
  const normalized = normalizedVehicleType(vehicleType);
  if (normalized.includes("TAXIBUS")) return "Taxibus";
  if (normalized.includes("MINIBUS")) return "Minibus";
  if (normalized.includes("BUS")) return "Bus";
  return null;
}

export function resolveAtlasVehicleRoutingModel(vehicleType: string): AtlasVehicleRoutingModel {
  const category = resolveAtlasRouteVehicleCategory(vehicleType);
  if (!category) throw new Error("Selecciona Bus, Taxibus o Minibus para calcular el recorrido.");
  return ROUTING_MODELS[category];
}

export function getAvailableAtlasRouteVehicleCategories(vehicles: Array<{ vehicle_type: string | null }>): AtlasRouteVehicleCategory[] {
  const activeCategories = new Set(vehicles.map((vehicle) => resolveAtlasRouteVehicleCategory(vehicle.vehicle_type)).filter((category): category is AtlasRouteVehicleCategory => category !== null));
  return ATLAS_ROUTE_VEHICLE_CATEGORIES.filter((category) => activeCategories.has(category));
}

export function atlasVehicleTypesMatch(planned: string | null | undefined, assigned: string | null | undefined) {
  const plannedCategory = resolveAtlasRouteVehicleCategory(planned);
  const assignedCategory = resolveAtlasRouteVehicleCategory(assigned);
  return plannedCategory !== null && assignedCategory !== null && plannedCategory === assignedCategory;
}
