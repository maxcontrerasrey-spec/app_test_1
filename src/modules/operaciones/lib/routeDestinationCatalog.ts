import { normalizeRouteStops } from "./routeStopOrder";

export type RouteDestinationPreset = {
  id: string;
  shortLabel: string;
  label: string;
  lat: number;
  lng: number;
  aliases: string[];
};

export const ROUTE_DESTINATION_PRESETS: RouteDestinationPreset[] = [
  {
    id: "bcd-dmh",
    shortLabel: "BCD DMH",
    label: "Barrio Cívico Divisional de Codelco División Ministro Hales (BCD DMH)",
    lat: -22.358077,
    lng: -68.902838,
    aliases: ["BCD DMH", "Barrio Civico Divisional", "Barrio Cívico Divisional DMH", "Codelco Division Ministro Hales", "Codelco División Ministro Hales"]
  },
  {
    id: "casa-cambio-mina-dmh",
    shortLabel: "Casa de Cambio Mina DMH",
    label: "Casa de Cambio Mina de Codelco División Ministro Hales (Casa de Cambio Mina DMH)",
    lat: -22.402779,
    lng: -68.912804,
    aliases: ["Casa de Cambio Mina DMH", "Casa Cambio Mina DMH", "Casa de Cambio Mina", "Casa Cambio DMH", "Codelco Division Ministro Hales"]
  },
  {
    id: "porteria-minera-el-abra",
    shortLabel: "Portería Minera El Abra",
    label: "Portería de Minera El Abra",
    lat: -22.035762,
    lng: -68.630502,
    aliases: ["Porteria Minera El Abra", "Porteria El Abra", "Portería El Abra", "Acceso Minera El Abra", "El Abra"]
  }
];

export const CALAMA_EXAMPLE_ADDRESS_QUERIES = [
  "Av. Balmaceda 3242, Calama, Chile",
  "Frei Bonn 3516, Calama, Chile"
] as const;

export function buildCalamaExampleStops(
  addresses: Array<{ label: string; lat: number; lng: number; providerPlaceId: string | null }>,
  createId: () => string
) {
  const destination = ROUTE_DESTINATION_PRESETS.find(({ id }) => id === "bcd-dmh");
  if (!destination) throw new Error("El destino BCD DMH no está configurado.");
  if (addresses.length !== CALAMA_EXAMPLE_ADDRESS_QUERIES.length) {
    throw new Error("El ejemplo Calama requiere dos direcciones de calle verificadas.");
  }

  return normalizeRouteStops([
    ...addresses.map((address) => ({
      ...address,
      id: createId(),
      source: "tomtom" as const,
      kind: "stop" as const
    })),
    {
      id: createId(),
      label: destination.label,
      lat: destination.lat,
      lng: destination.lng,
      providerPlaceId: null,
      source: "preset" as const,
      kind: "stop" as const,
      fixedDestination: true
    }
  ]);
}

export function normalizeDestinationSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchRouteDestinationPresets(query: string) {
  const normalizedQuery = normalizeDestinationSearch(query);
  if (!normalizedQuery) return ROUTE_DESTINATION_PRESETS;
  const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
  return ROUTE_DESTINATION_PRESETS.filter((destination) => {
    const searchable = [destination.label, ...destination.aliases].map(normalizeDestinationSearch);
    return searchable.some((value) => value.includes(normalizedQuery) || queryParts.every((part) => value.split(/\s+/).some((token) => token.startsWith(part))));
  });
}
