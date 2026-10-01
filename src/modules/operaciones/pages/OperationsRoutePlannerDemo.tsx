import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { FerrostarCore, FerrostarMap, SimulatedLocationProvider } from "@stadiamaps/ferrostar-webcomponents";
import type { Route, TripState, UserLocation, Waypoint } from "@stadiamaps/ferrostar";
import "maplibre-gl/dist/maplibre-gl.css";
import "../styles/route-planner-demo.css";

setWorkerUrl(mapLibreWorkerUrl);

const PHOTON_URL = "https://photon.komoot.io/api/";
const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const CALAMA = { lat: -22.4544, lng: -68.9294 };
const PHOTON_CACHE_TTL_MS = 5 * 60 * 1000;
const PHOTON_CACHE = new Map<string, { expiresAt: number; results: Array<{ label: string; lat: number; lng: number }> }>();
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }]
};

type Stop = { id: string; label: string; lat: number; lng: number; kind: "origin" | "stop" | "destination" };
type PhotonFeature = { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } };
type SearchState = { id: string; query: string; revision?: number; results: Array<{ label: string; lat: number; lng: number }>; status: "idle" | "loading" | "ready" | "error"; error?: string };
type SuggestionAnchor = { top: number; left: number; width: number; maxHeight: number };

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

function featureLabel(feature: PhotonFeature) {
  const p = feature.properties;
  return [p.name, p.street, p.housenumber, p.locality ?? p.city, p.state].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

async function searchPhoton(query: string, signal?: AbortSignal) {
  const cacheKey = query.trim().toLocaleLowerCase("es-CL");
  const cached = PHOTON_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  if (cached) PHOTON_CACHE.delete(cacheKey);
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("lat", String(CALAMA.lat));
  url.searchParams.set("lon", String(CALAMA.lng));
  url.searchParams.set("limit", "6");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Photon respondió ${response.status}.`);
  const data = await response.json() as { features?: PhotonFeature[] };
  const results = (data.features ?? []).map((feature) => ({ label: featureLabel(feature), lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] })).filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng));
  while (PHOTON_CACHE.size >= 80) PHOTON_CACHE.delete(PHOTON_CACHE.keys().next().value!);
  PHOTON_CACHE.set(cacheKey, { expiresAt: Date.now() + PHOTON_CACHE_TTL_MS, results });
  return results;
}

function locationAt(stop: Stop): UserLocation {
  return {
    coordinates: { lat: stop.lat, lng: stop.lng },
    horizontalAccuracy: 8,
    courseOverGround: { degrees: 0, accuracy: undefined },
    timestamp: { secs_since_epoch: Math.floor(Date.now() / 1000), nanos_since_epoch: 0 },
    speed: { value: 0, accuracy: undefined }
  };
}

function followNavigationCamera(map: MapLibreMap | null, state: TripState | null) {
  if (!map || !state || !("Navigating" in state)) return;
  const { userLocation } = state.Navigating;
  const { lat, lng } = userLocation.coordinates;
  const bearing = userLocation.courseOverGround?.degrees;
  const speedKmh = (userLocation.speed?.value ?? 0) * 3.6;
  const distanceToManeuver = state.Navigating.progress.distanceToNextManeuver;
  const zoom = distanceToManeuver < 250 ? 18.4 : distanceToManeuver < 900 ? 18 : speedKmh >= 70 ? 16.5 : speedKmh >= 40 ? 17 : 17.6;
  requestAnimationFrame(() => {
    if (!map.getCanvas().isConnected) return;
    map.easeTo({
      center: [lng, lat],
      zoom,
      pitch: 48,
      ...(bearing === undefined ? {} : { bearing }),
      offset: [0, map.getContainer().clientHeight * 0.18],
      duration: 450,
      essential: true
    });
  });
}

function navigationConfig() {
  return {
    stepAdvanceCondition: { DistanceEntryExit: { minimumHorizontalAccuracy: 25, distanceToEndOfStep: 30, distanceAfterEndStep: 5, hasReachedEndOfCurrentStep: false } },
    arrivalStepAdvanceCondition: { DistanceToEndOfStep: { distance: 30, minimumHorizontalAccuracy: 25 } },
    routeDeviationTracking: { StaticThreshold: { minimumHorizontalAccuracy: 25, maxAcceptableDeviation: 10 } },
    snappedLocationCourseFiltering: "Raw",
    waypointAdvance: { WaypointWithinRange: 100 }
  };
}

export function OperationsRoutePlannerDemo() {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ferrostarMapRef = useRef<FerrostarMap | null>(null);
  const coreRef = useRef<FerrostarCore | null>(null);
  const locationProviderRef = useRef<SimulatedLocationProvider | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [suggestionAnchor, setSuggestionAnchor] = useState<SuggestionAnchor | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeState, setRouteState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeView, setActiveView] = useState<"planning" | "driver">("planning");
  const [tripState, setTripState] = useState<TripState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapPickingStopId, setMapPickingStopId] = useState<string | null>(null);

  const core = useMemo(() => {
    const instance = new FerrostarCore();
    instance.valhallaEndpointUrl = VALHALLA_URL;
    instance.profile = "auto";
    instance.options = { costing_options: { auto: { use_ferry: 0, use_tolls: 0.5 } }, directions_options: { language: "es-ES", units: "kilometers" } };
    instance.onTripStateChange = (state) => {
      setTripState(state);
      followNavigationCamera(mapRef.current, state);
    };
    coreRef.current = instance;
    return instance;
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = new maplibregl.Map({ container: mapContainerRef.current, style: MAP_STYLE, center: [CALAMA.lng, CALAMA.lat], zoom: 12.2 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.once("load", () => setMapReady(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = stops.map((stop, index) => {
      const node = document.createElement("div");
      node.className = `ops-route-demo__map-marker ops-route-demo__map-marker--${stop.kind}`;
      node.textContent = stop.kind === "origin" ? "A" : stop.kind === "destination" ? "B" : String(index);
      return new maplibregl.Marker({ element: node }).setLngLat([stop.lng, stop.lat]).addTo(map);
    });
    if (!mapReady || !map.isStyleLoaded()) return;
    const geo = route && activeView === "planning" ? { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route.geometry.map((point) => [point.lng, point.lat]) } } : null;
    const source = map.getSource("planned-route") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(geo ?? { type: "FeatureCollection", features: [] });
    else if (geo) {
      map.addSource("planned-route", { type: "geojson", data: geo });
      map.addLayer({ id: "planned-route-halo", type: "line", source: "planned-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 10 } });
      map.addLayer({ id: "planned-route-line", type: "line", source: "planned-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#4b37c7", "line-width": 6 } });
    }
    if (stops.length && activeView === "planning") {
      const bounds = new maplibregl.LngLatBounds();
      stops.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
      if (route?.geometry.length) route.geometry.forEach(({ lat, lng }) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 65, right: 65 }, maxZoom: 15, duration: 500 });
    }
  }, [stops, route, activeView, mapReady]);

  useEffect(() => {
    const ferrostarMap = ferrostarMapRef.current;
    const map = mapRef.current;
    if (!ferrostarMap || !map) return;
    ferrostarMap.map = map;
    ferrostarMap.system = "metric";
    ferrostarMap.addGeolocateControl = false;
    ferrostarMap.geolocateOnLoad = false;
    ferrostarMap.linkWith(core, true);
    ferrostarMap.route = route;
  }, [core, route, activeView]);

  useEffect(() => {
    const searchId = search?.id;
    const query = search?.query.trim() ?? "";
    if (!searchId || query.length < 3 || !search) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setSearch((current) => current?.id === searchId && current.query.trim() === query ? { ...current, status: "loading", error: undefined } : current);
      void searchPhoton(query, controller.signal).then((results) => {
        setSearch((current) => current?.id === searchId && current.query.trim() === query ? { ...current, results, status: "ready", error: undefined } : current);
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setSearch((current) => current?.id === searchId && current.query.trim() === query ? { ...current, results: [], status: "error", error: reason instanceof Error ? reason.message : "No fue posible buscar la dirección." } : current);
      });
    }, 180);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search?.id, search?.query, search?.revision]);

  const showSearchPopover = Boolean(search && search.query.trim().length >= 3 && search.status !== "idle");

  useEffect(() => {
    if (!search || !showSearchPopover) {
      setSuggestionAnchor(null);
      return;
    }

    const updatePosition = () => {
      const input = document.getElementById(`route-${search.id}`);
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8));
      const width = Math.min(rect.width, window.innerWidth - 16);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openAbove = spaceBelow < 150 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(96, Math.min(220, openAbove ? spaceAbove : spaceBelow));
      setSuggestionAnchor({
        top: openAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
        left,
        width,
        maxHeight
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [search?.id, search?.query, search?.status, showSearchPopover]);

  function chooseResult(stopId: string, result: { label: string; lat: number; lng: number }) {
    const existing = stops.find((stop) => stop.id === stopId);
    const kind = existing?.label ? existing.kind : (!stops.some((stop) => stop.kind === "origin") ? "origin" : !stops.some((stop) => stop.kind === "destination") ? "destination" : "stop");
    setStops((current) => {
      const found = current.some((stop) => stop.id === stopId);
      if (found) return current.map((stop) => stop.id === stopId ? { ...stop, ...result, kind } : stop);
      const next: Stop = { id: stopId, ...result, kind };
      if (kind === "origin") return [next, ...current];
      if (kind === "destination") return [...current, next];
      return [...current.filter((stop) => stop.kind !== "destination"), next, ...current.filter((stop) => stop.kind === "destination")];
    });
    setSearch(null);
    setRoute(null);
    setRouteState("idle");
    setError("");
  }

  function startMapPick(stop: Stop) {
    const map = mapRef.current;
    setSearch(null);
    setMapPickingStopId(stop.id);
    if (stop.label && map) map.flyTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 16), duration: 450 });
  }

  function confirmMapPick() {
    const stopId = mapPickingStopId;
    const center = mapRef.current?.getCenter();
    if (!stopId || !center) return;
    const lat = Number(center.lat.toFixed(6));
    const lng = Number(center.lng.toFixed(6));
    chooseResult(stopId, { label: `Punto en mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng });
    setMapPickingStopId(null);
    setAdding(false);
    setNotice("Punto manual seleccionado. Puedes calcular la ruta con estas coordenadas.");
  }

  function addStop() {
    const stop: Stop = { id: uid(), label: "", lat: 0, lng: 0, kind: "stop" };
    setStops((current) => {
      const index = current.findIndex((item) => item.kind === "destination");
      if (index < 0) return [...current, stop];
      return [...current.slice(0, index), stop, ...current.slice(index)];
    });
    setSearch({ id: stop.id, query: "", results: [], status: "idle" });
    setAdding(true);
  }

  function removeStop(id: string) {
    setStops((current) => current.filter((stop) => stop.id !== id));
    setRoute(null);
    setRouteState("idle");
  }

  function moveStop(id: string, direction: -1 | 1) {
    setStops((current) => {
      const index = current.findIndex((stop) => stop.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length || current[index]?.kind !== "stop" || current[nextIndex]?.kind === "origin" || current[nextIndex]?.kind === "destination") return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
    setRoute(null);
    setRouteState("idle");
  }

  async function loadExample() {
    setError("");
    setNotice("Buscando tres puntos de ejemplo en Calama…");
    const queries = ["Av. Balmaceda 3242, Calama, Chile", "Frei Bonn 3516, Calama, Chile", "División Ministro Hales, Calama, Chile"];
    try {
      const located = await Promise.all(queries.map((query) => searchPhoton(query)));
      const mapped: Stop[] = located.map((list, index) => {
        const match = list[0];
        if (!match) throw new Error(`Photon no encontró: ${queries[index]}`);
        return { id: uid(), ...match, kind: index === 0 ? "origin" : index === 2 ? "destination" : "stop" };
      });
      setStops(mapped);
      setRoute(null);
      setRouteState("idle");
      setNotice("Ejemplo cargado. Genera la ruta para continuar.");
    } catch (reason) {
      setNotice("");
      setError(reason instanceof Error ? reason.message : "No fue posible cargar el ejemplo de Calama.");
    }
  }

  async function generateRoute() {
    if (stops.length < 2 || stops.some((stop) => !stop.label || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng))) {
      setError("Agrega origen, destino y direcciones válidas antes de calcular.");
      return;
    }
    setRouteState("loading");
    setError("");
    setNotice("");
    try {
      const initialLocation = locationAt(stops[0]!);
      const waypoints: Waypoint[] = stops.slice(1).map((stop) => ({ coordinate: { lat: stop.lat, lng: stop.lng }, kind: "Break", properties: undefined }));
      const routes = await core.getRoutes(initialLocation, waypoints);
      if (!routes.length) throw new Error("Valhalla no devolvió una ruta para estas paradas.");
      setRoute(routes[0]!);
      setRouteState("ready");
      setNotice("Ruta calculada por Valhalla · perfil auto de referencia.");
    } catch (reason) {
      setRouteState("error");
      setError(reason instanceof Error ? reason.message : "No fue posible calcular la ruta.");
    }
  }

  async function startSimulation() {
    if (!route) return;
    setError("");
    try {
      await core.stopNavigation();
      const provider = new SimulatedLocationProvider();
      provider.warpFactor = 8;
      core.locationProvider = provider;
      locationProviderRef.current = provider;
      ferrostarMapRef.current?.linkWith(core, true);
      if (ferrostarMapRef.current) ferrostarMapRef.current.route = route;
      core.startNavigation(route, navigationConfig());
      provider.setSimulatedRoute(route);
      setActiveView("driver");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible iniciar la simulación.");
    }
  }

  async function stopSimulation() {
    locationProviderRef.current?.stop();
    await core.stopNavigation();
    setTripState(null);
    setActiveView("planning");
  }

  const nextInstruction = tripState && "Navigating" in tripState ? tripState.Navigating.spokenInstruction?.text : "Listo para simular el recorrido";
  const allStopsPresent = stops.length >= 2 && stops.every((stop) => stop.label);
  const addingSearchId = adding ? search?.id : undefined;

  return <main className="ops-route-demo">
    <header className="ops-route-demo__header">
      <div><span className="ops-route-demo__eyebrow">ATLAS OPERATIONS · PLANIFICACIÓN</span><h1>Planificador de rutas</h1><p>Define direcciones y revisa el recorrido con giro a giro en Calama.</p></div>
      <div className="ops-route-demo__header-actions"><span className="ops-route-demo__local-pill"><i /> Vista previa</span><button type="button" className="ops-route-demo__secondary" onClick={() => navigate("/operaciones/control-tower")}>Volver a Operaciones</button></div>
    </header>
    <div className="ops-route-demo__workspace">
      <section className="ops-route-demo__panel" aria-label="Planificador de recorrido">
        <div className="ops-route-demo__panel-head"><div><h2>{activeView === "planning" ? "Recorrido del servicio" : "Vista del conductor"}</h2><p>{activeView === "planning" ? "Define el orden real de las paradas." : "Simulación de avance por instrucciones."}</p></div><span className="ops-route-demo__counter">{stops.length} paradas</span></div>
        <div className="ops-route-demo__view-switch" role="tablist" aria-label="Vistas de demo">
          <button type="button" role="tab" aria-selected={activeView === "planning"} className={activeView === "planning" ? "is-active" : ""} onClick={() => activeView === "driver" ? void stopSimulation() : setActiveView("planning")}>Planificación</button>
          <button type="button" role="tab" aria-selected={activeView === "driver"} className={activeView === "driver" ? "is-active" : ""} onClick={() => route && void startSimulation()}>Conductor</button>
        </div>
        {activeView === "planning" ? <>
          <div className="ops-route-demo__stops">
            {stops.map((stop, index) => <div key={stop.id} className="ops-route-demo__stop-row">
              <span className={`ops-route-demo__stop-pin ops-route-demo__stop-pin--${stop.kind}`}>{stop.kind === "origin" ? "A" : stop.kind === "destination" ? "B" : index}</span>
              <div className="ops-route-demo__stop-input-wrap">
                <label htmlFor={`route-${stop.id}`}>{stop.kind === "origin" ? "Origen" : stop.kind === "destination" ? "Destino" : `Parada ${index}`}</label>
                <div className="ops-route-demo__input-action"><input id={`route-${stop.id}`} value={search?.id === stop.id ? search.query : stop.label} placeholder="Busca una dirección en Calama" onChange={(event) => { const query = event.target.value; setSearch({ id: stop.id, query, results: [], status: query.trim().length >= 3 ? "loading" : "idle" }); }} onFocus={() => { if (!stop.label) setSearch({ id: stop.id, query: "", results: [], status: "idle" }); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSearch((current) => current?.id === stop.id ? { ...current, revision: (current.revision ?? 0) + 1, status: current.query.trim().length >= 3 ? "loading" : "idle" } : current); } }} /><button type="button" className="ops-route-demo__map-pick-button" aria-label={`Elegir punto en el mapa para ${stop.kind === "origin" ? "el origen" : stop.kind === "destination" ? "el destino" : `la parada ${index + 1}`}`} title="Elegir punto en el mapa" onClick={() => startMapPick(stop)}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.5" /><path d="M10 1.5v3M10 15.5v3M1.5 10h3m11 0h3" /></svg><span>Mapa</span></button>{stop.label && stop.kind === "stop" && <button type="button" aria-label={`Quitar ${stop.label}`} onClick={() => removeStop(stop.id)}>×</button>}</div>
              </div>
              <div className="ops-route-demo__stop-actions"><button type="button" title="Subir parada" aria-label="Subir parada" disabled={stop.kind !== "stop" || index === 1} onClick={() => moveStop(stop.id, -1)}>↑</button><button type="button" title="Bajar parada" aria-label="Bajar parada" disabled={stop.kind !== "stop" || index === stops.length - 1} onClick={() => moveStop(stop.id, 1)}>↓</button></div>
            </div>)}
            {stops.length === 0 && <div className="ops-route-demo__empty"><div className="ops-route-demo__empty-icon">A</div><strong>Agrega un origen y un destino</strong><span>Luego puedes insertar tantas paradas como necesites.</span></div>}
          </div>
          <button type="button" className="ops-route-demo__add-stop" onClick={addStop} disabled={Boolean(addingSearchId)}>＋ <span>Agregar una parada</span></button>
          <div className="ops-route-demo__panel-divider" />
          {route && routeState === "ready" && <div className="ops-route-demo__summary"><div><span>Distancia estimada</span><strong>{formatDistance(route.distance)}</strong></div><div><span>Tiempo estimado</span><strong>{formatDuration(route.steps.reduce((total, step) => total + step.duration, 0))}</strong></div></div>}
          <div className="ops-route-demo__actions"><button type="button" className="ops-route-demo__primary" disabled={!allStopsPresent || routeState === "loading"} onClick={() => void generateRoute()}>{routeState === "loading" ? "Calculando ruta…" : "Calcular ruta"}</button><button type="button" className="ops-route-demo__secondary" onClick={() => void loadExample()}>Cargar ejemplo Calama</button></div>
          {route && <button type="button" className="ops-route-demo__driver-launch" onClick={() => void startSimulation()}><span><strong>Probar vista del conductor</strong><small>Simular navegación sobre esta misma ruta</small></span><span>→</span></button>}
        </> : <div className="ops-route-demo__driver-panel"><div className="ops-route-demo__guidance"><span>PRÓXIMA INSTRUCCIÓN</span><strong>{nextInstruction}</strong><small>El avance simulado ocurre a velocidad ×8 para recorrerla en el demo.</small></div><div className="ops-route-demo__driver-stats"><div><span>Recorrido</span><strong>{route ? formatDistance(route.distance) : "—"}</strong></div><div><span>Tiempo base</span><strong>{route ? formatDuration(route.steps.reduce((total, step) => total + step.duration, 0)) : "—"}</strong></div></div><button type="button" className="ops-route-demo__secondary" onClick={() => void stopSimulation()}>Detener navegación</button><p>La simulación avanza automáticamente con las maniobras de Ferrostar; no usa GPS ni publica una asignación.</p></div>}
        {error && <div className="ops-route-demo__message ops-route-demo__message--error" role="alert">{error}</div>}
        {notice && <div className="ops-route-demo__message" role="status">{notice}</div>}
        <div className="ops-route-demo__limitations"><strong>Vista previa</strong><p>La ruta usa el perfil auto y todavía no se guarda en un servicio base. Photon y Valhalla públicos son servicios de prueba; las restricciones de buses/faena y la optimización inteligente se incorporarán en una etapa posterior.</p></div>
      </section>
      <section className="ops-route-demo__map-section" aria-label="Mapa y ruta">
        <div className="ops-route-demo__map-topline"><div><span className="ops-route-demo__eyebrow">{activeView === "planning" ? "MAPA DE PLANIFICACIÓN" : "NAVEGACIÓN SIMULADA"}</span><strong>Calama, Región de Antofagasta</strong></div><div className="ops-route-demo__map-legend"><span><i className="is-start" />Inicio</span><span><i className="is-stop" />Parada</span><span><i className="is-end" />Destino</span></div></div>
        <div className={`ops-route-demo__map-frame${mapPickingStopId ? " is-picking" : ""}`}><div className="ops-route-demo__map-canvas" ref={mapContainerRef} />{activeView === "driver" && <ferrostar-map ref={(node) => { ferrostarMapRef.current = node; }} className="ops-route-demo__ferrostar" show-navigation-ui show-user-marker system="metric" />} {!route && routeState !== "loading" && !mapPickingStopId && <div className="ops-route-demo__map-empty"><span>＋</span><strong>Tu ruta aparecerá aquí</strong><small>Agrega direcciones o carga el ejemplo de Calama.</small></div>}{mapPickingStopId && <><div className="ops-route-demo__map-center-pin" aria-hidden="true"><svg viewBox="0 0 28 36"><path d="M14 1C6.82 1 1 6.82 1 14c0 9.1 13 21 13 21s13-11.9 13-21C27 6.82 21.18 1 14 1Z" /><circle cx="14" cy="14" r="4.5" /></svg></div><div className="ops-route-demo__map-pick-hint" role="status">Mueve el mapa hasta ubicar el punto bajo el marcador</div><div className="ops-route-demo__map-pick-actions"><button type="button" className="ops-route-demo__primary" onClick={confirmMapPick}>Usar este punto</button><button type="button" className="ops-route-demo__secondary" onClick={() => setMapPickingStopId(null)}>Cancelar</button></div></>}{routeState === "loading" && <div className="ops-route-demo__map-loading">Calculando ruta…</div>}</div>
        <div className="ops-route-demo__map-foot"><span><i /> Ruta y maniobras de Valhalla</span><span>Mapa © OpenStreetMap contributors</span></div>
      </section>
    </div>
    {showSearchPopover && search && suggestionAnchor && createPortal(
      <div
        className="ops-route-demo__suggestions"
        style={{ top: suggestionAnchor.top, left: suggestionAnchor.left, width: suggestionAnchor.width, maxHeight: suggestionAnchor.maxHeight }}
        role="region"
        aria-label="Sugerencias de direcciones"
        aria-live="polite"
      >
        {search.status === "loading" && <div className="ops-route-demo__suggestion-hint" role="status">Buscando direcciones… Si no aparece, puedes elegir el punto en el mapa.</div>}
        {search.status === "ready" && search.results.map((result) => <button type="button" role="option" key={`${result.lat}-${result.lng}`} onClick={() => { chooseResult(search.id, result); setAdding(false); }}>{result.label}</button>)}
        {search.status === "ready" && search.results.length === 0 && <div className="ops-route-demo__suggestion-hint" role="status">No encontramos coincidencias. Prueba con calle y ciudad; presiona Enter para reintentar.</div>}
        {search.status === "error" && <div className="ops-route-demo__suggestion-hint" role="alert">No se pudo consultar Photon. {search.error} Presiona Enter para reintentar.</div>}
      </div>,
      document.body
    )}
  </main>;
}
