import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { FerrostarCore, FerrostarMap, SimulatedLocationProvider } from "@stadiamaps/ferrostar-webcomponents";
import type { Route, TripState, UserLocation, Waypoint } from "@stadiamaps/ferrostar";
import { calculateAtlasTomTomRoute, getAtlasOperationsCatalogs, getAtlasServiceRoute, getAtlasServiceRoutes, resolveAtlasTomTomSuggestion, saveAtlasServiceRoute, searchAtlasTomTom, type AtlasServiceRoute, type TomTomRoute, type TomTomSuggestion } from "../services/atlasOperationsApi";
import { appendRouteStop, moveRouteStop, normalizeRouteStops } from "../lib/routeStopOrder";
import "maplibre-gl/dist/maplibre-gl.css";
import "../styles/route-planner-demo.css";

setWorkerUrl(mapLibreWorkerUrl);

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const CALAMA = { lat: -22.4544, lng: -68.9294 };
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

type Stop = { id: string; label: string; lat: number; lng: number; kind: "origin" | "stop" | "destination"; providerPlaceId: string | null; source: "tomtom" | "map_pin" };
type SearchState = { id: string; query: string; sessionId: string; revision?: number; results: TomTomSuggestion[]; status: "idle" | "loading" | "ready" | "error"; error?: string };
type SuggestionAnchor = { top: number; left: number; width: number; maxHeight: number };

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

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

function createRouteArrowImage(): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible preparar las flechas de ruta.");
  context.fillStyle = "#4b37c7";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(5, 7);
  context.lineTo(26, 16);
  context.lineTo(5, 25);
  context.lineTo(9, 16);
  context.closePath();
  context.fill();
  context.stroke();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function ensurePlannedRouteLayers(map: MapLibreMap) {
  if (!map.getSource("planned-route")) {
    map.addSource("planned-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer("planned-route-halo")) {
    map.addLayer({ id: "planned-route-halo", type: "line", source: "planned-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 10 } });
  }
  if (!map.getLayer("planned-route-line")) {
    map.addLayer({ id: "planned-route-line", type: "line", source: "planned-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#4b37c7", "line-width": 6 } });
  }
  if (!map.hasImage("planned-route-arrow")) map.addImage("planned-route-arrow", createRouteArrowImage(), { pixelRatio: 2 });
  if (!map.getLayer("planned-route-arrows")) {
    map.addLayer({
      id: "planned-route-arrows",
      type: "symbol",
      source: "planned-route",
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 110,
        "icon-image": "planned-route-arrow",
        "icon-size": 0.72,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    });
  }
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
  const [searchParams] = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ferrostarMapRef = useRef<FerrostarMap | null>(null);
  const coreRef = useRef<FerrostarCore | null>(null);
  const locationProviderRef = useRef<SimulatedLocationProvider | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [suggestionAnchor, setSuggestionAnchor] = useState<SuggestionAnchor | null>(null);
  const [planningRoute, setPlanningRoute] = useState<TomTomRoute | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeState, setRouteState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeView, setActiveView] = useState<"planning" | "driver">("planning");
  const [tripState, setTripState] = useState<TripState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapPickingStopId, setMapPickingStopId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getAtlasOperationsCatalogs>> | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [routePrefix, setRoutePrefix] = useState("");
  const [savedRoutes, setSavedRoutes] = useState<AtlasServiceRoute[]>([]);
  const [selectedSavedRouteId, setSelectedSavedRouteId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const routeId = searchParams.get("routeId");
    if (!routeId) return;
    let active = true;
    void getAtlasServiceRoute(routeId).then(async (saved) => {
      if (!active) return;
      setSelectedServiceId(String(saved.service_template_id));
      setRoutePrefix(saved.prefix);
      setSelectedSavedRouteId(saved.id);
      const ordered = [...saved.atlas_ops_service_route_stops].sort((a, b) => a.stop_order - b.stop_order);
      const loaded: Stop[] = ordered.map((stop, index) => ({ id: uid(), label: stop.label, lat: stop.latitude, lng: stop.longitude, kind: index === 0 ? "origin" : index === ordered.length - 1 ? "destination" : "stop", providerPlaceId: stop.provider_place_id, source: stop.location_source }));
      setStops(loaded);
      setRouteState("loading");
      const preview = await calculateAtlasTomTomRoute(loaded.map(({ lat, lng }) => ({ lat, lng })));
      if (!active) return;
      setPlanningRoute(preview);
      setRouteState("ready");
      setNotice(`Ruta asignada ${saved.route_code} cargada. La vista de planificación usa TomTom; la navegación recalcula con Valhalla.`);
    }).catch((reason: unknown) => { if (active) { setRouteState("error"); setError(reason instanceof Error ? reason.message : "No fue posible cargar la ruta asignada."); } });
    return () => { active = false; };
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    void getAtlasOperationsCatalogs().then((value) => { if (active) setCatalog(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No fue posible cargar los servicios base."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedServiceId) { setSavedRoutes([]); setSelectedSavedRouteId(""); return; }
    let active = true;
    setSavedRoutes([]);
    void getAtlasServiceRoutes(Number(selectedServiceId)).then((routes) => {
      if (!active) return;
      setSavedRoutes(routes);
      const current = routes.find((item) => item.is_active);
      setSelectedSavedRouteId(current?.id ?? "");
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No fue posible leer las rutas del servicio."); });
    return () => { active = false; };
  }, [selectedServiceId]);

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
    map.once("load", () => {
      ensurePlannedRouteLayers(map);
      setMapReady(true);
    });
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
    const locatedStops = stops.filter((stop) => stop.label.trim().length > 0);
    markersRef.current = locatedStops.map((stop) => {
      const index = stops.findIndex((item) => item.id === stop.id);
      const node = document.createElement("div");
      node.className = `ops-route-demo__map-marker ops-route-demo__map-marker--${stop.kind}`;
      node.textContent = stop.kind === "origin" ? "A" : stop.kind === "destination" ? "B" : String(index);
      return new maplibregl.Marker({ element: node }).setLngLat([stop.lng, stop.lat]).addTo(map);
    });
    if (!mapReady) return;
    const planningCoordinates = planningRoute?.coordinates ?? [];
    const geo = activeView === "planning" && planningCoordinates.length > 1
      ? { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: planningCoordinates } }
      : activeView === "driver" && route?.geometry.length
        ? { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route.geometry.map((point) => [point.lng, point.lat]) } }
        : null;
    ensurePlannedRouteLayers(map);
    const source = map.getSource("planned-route") as maplibregl.GeoJSONSource;
    source.setData(geo ?? { type: "FeatureCollection", features: [] });
    if (activeView === "planning" && (locatedStops.length > 0 || planningCoordinates.length > 0)) {
      const bounds = new maplibregl.LngLatBounds();
      locatedStops.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
      planningCoordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 65, right: 65 }, maxZoom: 15, duration: 500 });
      }
    }
  }, [stops, route, planningRoute, activeView, mapReady]);

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
      void searchAtlasTomTom(query, search.sessionId, controller.signal).then((results) => {
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
  }, [search?.id, search?.query, search?.sessionId, search?.revision]);

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

  function chooseResult(stopId: string, result: { id?: string | null; label: string; lat: number; lng: number; source?: "tomtom" | "map_pin" }) {
    const { id: placeId, ...coordinates } = result;
    const location = { ...coordinates, providerPlaceId: placeId ?? null, source: result.source ?? "tomtom" as const };
    setStops((current) => {
      const found = current.some((stop) => stop.id === stopId);
      const updated = found
        ? current.map((stop) => stop.id === stopId ? { ...stop, ...location } : stop)
        : [...current, { id: stopId, ...location, kind: "stop" as const }];
      return normalizeRouteStops(updated);
    });
    setSearch(null);
    setPlanningRoute(null);
    setRoute(null);
    setRouteState("idle");
    setError("");
  }

  async function selectSuggestion(stopId: string, suggestion: TomTomSuggestion) {
    if (!suggestion.id || !suggestion.type || !search) return;
    const sessionId = search.sessionId;
    setSearch((current) => current?.id === stopId ? { ...current, status: "loading", error: undefined } : current);
    try {
      const place = await resolveAtlasTomTomSuggestion(suggestion, sessionId);
      chooseResult(stopId, { ...place, source: "tomtom" });
      setSearch(null);
      setAdding(false);
      setNotice("Dirección verificada por TomTom y ubicada en el mapa.");
    } catch (reason) {
      setSearch((current) => current?.id === stopId ? { ...current, status: "error", error: reason instanceof Error ? reason.message : "No se pudo resolver la ubicación." } : current);
    }
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
    chooseResult(stopId, { label: `Punto en mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng, source: "map_pin" });
    setMapPickingStopId(null);
    setAdding(false);
    setNotice("Punto manual seleccionado. Puedes calcular la ruta con estas coordenadas.");
  }

  function addStop() {
    const center = mapRef.current?.getCenter();
    const stop: Stop = {
      id: uid(), label: "", lat: center?.lat ?? CALAMA.lat, lng: center?.lng ?? CALAMA.lng,
      kind: "stop", providerPlaceId: null, source: "tomtom"
    };
    setStops((current) => appendRouteStop(current, stop));
    setSearch({ id: stop.id, query: "", sessionId: crypto.randomUUID(), results: [], status: "idle" });
    setAdding(true);
  }

  function removeStop(id: string) {
    setStops((current) => normalizeRouteStops(current.filter((stop) => stop.id !== id)));
    setPlanningRoute(null);
    setRoute(null);
    setRouteState("idle");
  }

  function moveStop(id: string, direction: -1 | 1) {
    setStops((current) => moveRouteStop(current, id, direction));
    setRoute(null);
    setRouteState("idle");
  }

  async function loadExample() {
    setError("");
    setNotice("Buscando tres puntos de ejemplo en Calama…");
    const queries = ["Av. Balmaceda 3242, Calama, Chile", "Frei Bonn 3516, Calama, Chile", "División Ministro Hales, Calama, Chile"];
    try {
      const sessions = queries.map(() => crypto.randomUUID());
      const located = await Promise.all(queries.map((query, index) => searchAtlasTomTom(query, sessions[index]!)));
      const matches = await Promise.all(located.map((list, index) => {
        const suggestion = list[0];
        if (!suggestion) throw new Error(`TomTom no encontró: ${queries[index]}`);
        return resolveAtlasTomTomSuggestion(suggestion, sessions[index]!);
      }));
      const mapped: Stop[] = matches.map((match, index) => ({ id: uid(), label: match.label, lat: match.lat, lng: match.lng, providerPlaceId: match.id, source: "tomtom" as const, kind: index === 0 ? "origin" as const : index === 2 ? "destination" as const : "stop" as const }));
      setStops(mapped);
      setPlanningRoute(null);
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
      const result = await calculateAtlasTomTomRoute(stops.map(({ lat, lng }) => ({ lat, lng })));
      setPlanningRoute(result);
      setRoute(null);
      setRouteState("ready");
      setNotice("Vista previa de planificación calculada por TomTom · perfil vial de automóvil; las restricciones de bus no están disponibles en esta API.");
    } catch (reason) {
      setRouteState("error");
      setError(reason instanceof Error ? reason.message : "No fue posible calcular la ruta.");
    }
  }

  async function startSimulation() {
    if (!planningRoute || stops.length < 2) return;
    setError("");
    try {
      const initialLocation = locationAt(stops[0]!);
      const waypoints: Waypoint[] = stops.slice(1).map((stop) => ({ coordinate: { lat: stop.lat, lng: stop.lng }, kind: "Break", properties: undefined }));
      const routes = await core.getRoutes(initialLocation, waypoints);
      if (!routes.length) throw new Error("Valhalla no devolvió una ruta para estas paradas.");
      const driverRoute = routes[0]!;
      setRoute(driverRoute);
      await core.stopNavigation();
      const provider = new SimulatedLocationProvider();
      provider.warpFactor = 8;
      core.locationProvider = provider;
      locationProviderRef.current = provider;
      ferrostarMapRef.current?.linkWith(core, true);
      if (ferrostarMapRef.current) ferrostarMapRef.current.route = driverRoute;
      core.startNavigation(driverRoute, navigationConfig());
      provider.setSimulatedRoute(driverRoute);
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

  async function saveRoute() {
    if (!selectedServiceId || !routePrefix.trim() || !planningRoute) return;
    setSaving(true);
    setError("");
    try {
      const id = await saveAtlasServiceRoute({
        serviceTemplateId: Number(selectedServiceId),
        prefix: routePrefix,
        stops: stops.map((stop) => ({ label: stop.label, lat: stop.lat, lng: stop.lng, providerPlaceId: stop.providerPlaceId, source: stop.source })),
        distanceMeters: planningRoute.distanceMeters,
        durationSeconds: planningRoute.durationSeconds
      });
      const routes = await getAtlasServiceRoutes(Number(selectedServiceId));
      setSavedRoutes(routes);
      setSelectedSavedRouteId(id);
      setNotice(`Ruta guardada: ${routes.find((item) => item.id === id)?.route_code ?? "servicio"}. El conductor recalculará el recorrido con Valhalla.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar la ruta.");
    } finally {
      setSaving(false);
    }
  }

  async function loadSavedRoute(routeId: string) {
    const selected = savedRoutes.find((item) => item.id === routeId);
    if (!selected) return;
    const orderedStops = [...selected.atlas_ops_service_route_stops].sort((a, b) => a.stop_order - b.stop_order);
    const loaded: Stop[] = orderedStops.map((stop, index) => ({
      id: uid(), label: stop.label, lat: stop.latitude, lng: stop.longitude,
      kind: index === 0 ? "origin" : index === orderedStops.length - 1 ? "destination" : "stop",
      providerPlaceId: stop.provider_place_id, source: stop.location_source
    }));
    setStops(loaded);
    setRoutePrefix(selected.prefix);
    setPlanningRoute(null);
    setRoute(null);
    setRouteState("loading");
    setSelectedSavedRouteId(routeId);
    try {
      const preview = await calculateAtlasTomTomRoute(loaded.map(({ lat, lng }) => ({ lat, lng })));
      setPlanningRoute(preview);
      setRouteState("ready");
      setNotice(`Ruta ${selected.route_code} · versión ${selected.version} cargada.`);
    } catch (reason) {
      setRouteState("error");
      setError(reason instanceof Error ? reason.message : "No se pudo volver a dibujar la ruta.");
    }
  }

  const nextInstruction = tripState && "Navigating" in tripState ? tripState.Navigating.spokenInstruction?.text : "Listo para simular el recorrido";
  const allStopsPresent = stops.length >= 2 && stops.every((stop) => stop.label);
  const addingSearchId = adding ? search?.id : undefined;
  const selectedTemplate = catalog?.templates.find((item) => String(item.id) === selectedServiceId);
  const selectedContract = catalog?.contracts.find((item) => item.id === selectedTemplate?.contract_id);
  const routeCodePreview = `${selectedTemplate?.name ?? "SERVICIO"}_${routePrefix.trim() || "PREFIJO"}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase();

  return <main className="ops-route-demo">
    <header className="ops-route-demo__header">
      <div><span className="ops-route-demo__eyebrow">ATLAS OPERATIONS · PLANIFICACIÓN</span><h1>Planificador de rutas</h1><p>Define direcciones y revisa el recorrido con giro a giro en Calama.</p></div>
      <div className="ops-route-demo__header-actions"><span className="ops-route-demo__local-pill"><i /> TomTom conectado</span><button type="button" className="ops-route-demo__secondary" onClick={() => navigate("/operaciones/control-tower")}>Volver a Operaciones</button></div>
    </header>
    <div className="ops-route-demo__workspace">
      <section className="ops-route-demo__panel" aria-label="Planificador de recorrido">
        <div className="ops-route-demo__panel-head"><div><h2>{activeView === "planning" ? "Recorrido del servicio" : "Vista del conductor"}</h2><p>{activeView === "planning" ? "Define el orden real de las paradas." : "Simulación de avance por instrucciones."}</p></div><span className="ops-route-demo__counter">{stops.length} paradas</span></div>
        {activeView === "planning" && <div className="ops-route-demo__route-config">
          <label>Servicio base<select value={selectedServiceId} onChange={(event) => { setSelectedServiceId(event.target.value); setStops([]); setPlanningRoute(null); setRoute(null); setRoutePrefix(""); setError(""); }}>
            <option value="">Selecciona servicio base</option>
            {catalog?.templates.map((item) => {
              const contract = catalog.contracts.find((candidate) => candidate.id === item.contract_id);
              return <option value={item.id} key={item.id}>{contract?.code ? `${contract.code} · ` : ""}{item.name}</option>;
            })}
          </select></label>
          <div className="ops-route-demo__route-config-row">
            <label>Prefijo de ruta<input value={routePrefix} maxLength={40} onChange={(event) => setRoutePrefix(event.target.value)} placeholder="Turno A / Turno B" /></label>
            <div className="ops-route-demo__route-code"><span>CÓDIGO</span><strong>{routeCodePreview}</strong></div>
          </div>
          <label>Rutas guardadas<select value={selectedSavedRouteId} onChange={(event) => void loadSavedRoute(event.target.value)} disabled={!savedRoutes.length}>
            <option value="">{savedRoutes.length ? "Crear nueva ruta" : "Aún no hay rutas guardadas"}</option>
            {savedRoutes.map((item) => <option key={item.id} value={item.id}>{item.route_code} · v{item.version}{item.is_active ? " · Activa" : " · Histórica"}</option>)}
          </select></label>
        </div>}
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
                <div className="ops-route-demo__input-action"><input id={`route-${stop.id}`} value={search?.id === stop.id ? search.query : stop.label} placeholder="Busca una dirección en Calama" onChange={(event) => { const query = event.target.value; const sessionId = search?.id === stop.id ? search.sessionId : crypto.randomUUID(); setSearch({ id: stop.id, query, sessionId, results: [], status: query.trim().length >= 3 ? "loading" : "idle" }); setPlanningRoute(null); setRoute(null); setRouteState("idle"); }} onFocus={() => { if (!stop.label) setSearch({ id: stop.id, query: "", sessionId: crypto.randomUUID(), results: [], status: "idle" }); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSearch((current) => current?.id === stop.id ? { ...current, revision: (current.revision ?? 0) + 1, status: current.query.trim().length >= 3 ? "loading" : "idle" } : current); } }} /><button type="button" className="ops-route-demo__map-pick-button" aria-label={`Elegir punto en el mapa para ${stop.kind === "origin" ? "el origen" : stop.kind === "destination" ? "el destino" : `la parada ${index + 1}`}`} title="Elegir punto en el mapa" onClick={() => startMapPick(stop)}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.5" /><path d="M10 1.5v3M10 15.5v3M1.5 10h3m11 0h3" /></svg><span>Mapa</span></button>{stop.label && stop.kind === "stop" && <button type="button" aria-label={`Quitar ${stop.label}`} onClick={() => removeStop(stop.id)}>×</button>}</div>
              </div>
              <div className="ops-route-demo__stop-actions"><button type="button" title="Subir punto" aria-label={`Subir ${stop.kind === "origin" ? "origen" : stop.kind === "destination" ? "destino" : `parada ${index}`}`} disabled={index === 0} onClick={() => moveStop(stop.id, -1)}>↑</button><button type="button" title="Bajar punto" aria-label={`Bajar ${stop.kind === "origin" ? "origen" : stop.kind === "destination" ? "destino" : `parada ${index}`}`} disabled={index === stops.length - 1} onClick={() => moveStop(stop.id, 1)}>↓</button></div>
            </div>)}
            {stops.length === 0 && <div className="ops-route-demo__empty"><div className="ops-route-demo__empty-icon">A</div><strong>Agrega un origen y un destino</strong><span>Luego puedes insertar tantas paradas como necesites.</span></div>}
          </div>
          <button type="button" className="ops-route-demo__add-stop" onClick={addStop} disabled={Boolean(addingSearchId)}>＋ <span>Agregar una parada</span></button>
          <div className="ops-route-demo__panel-divider" />
          {planningRoute && routeState === "ready" && <div className="ops-route-demo__summary"><div><span>Distancia estimada · TomTom</span><strong>{formatDistance(planningRoute.distanceMeters)}</strong></div><div><span>Tiempo estimado</span><strong>{formatDuration(planningRoute.durationSeconds)}</strong></div></div>}
          <div className="ops-route-demo__actions"><button type="button" className="ops-route-demo__primary" disabled={!allStopsPresent || routeState === "loading"} onClick={() => void generateRoute()}>{routeState === "loading" ? "Calculando ruta…" : "Calcular ruta"}</button><button type="button" className="ops-route-demo__secondary" onClick={() => void loadExample()}>Cargar ejemplo Calama</button></div>
          {planningRoute && <><button type="button" className="ops-route-demo__driver-launch" onClick={() => void startSimulation()}><span><strong>Probar navegación del conductor</strong><small>Recalcula con Ferrostar + Valhalla desde las mismas paradas</small></span><span>→</span></button><button type="button" className="ops-route-demo__primary ops-route-demo__save-route" disabled={!selectedServiceId || !routePrefix.trim() || saving} onClick={() => void saveRoute()}>{saving ? "Guardando ruta…" : selectedSavedRouteId ? "Guardar nueva versión" : "Guardar ruta en servicio base"}</button></>}
        </> : <div className="ops-route-demo__driver-panel"><div className="ops-route-demo__guidance"><span>PRÓXIMA INSTRUCCIÓN</span><strong>{nextInstruction}</strong><small>Ferrostar + Valhalla · simulación de referencia</small></div><div className="ops-route-demo__driver-stats"><div><span>Recorrido</span><strong>{route ? formatDistance(route.distance) : "—"}</strong></div><div><span>Tiempo base</span><strong>{route ? formatDuration(route.steps.reduce((total, step) => total + step.duration, 0)) : "—"}</strong></div></div><button type="button" className="ops-route-demo__secondary" onClick={() => void stopSimulation()}>Detener navegación</button><p>Se usan las coordenadas guardadas de las paradas; Valhalla puede elegir calles distintas a la vista previa de TomTom.</p></div>}
        {error && <div className="ops-route-demo__message ops-route-demo__message--error" role="alert">{error}</div>}
        {notice && <div className="ops-route-demo__message" role="status">{notice}</div>}
        <div className="ops-route-demo__limitations"><strong>Cómo se conectan los motores</strong><p>TomTom busca direcciones y calcula el trazado de planificación. Al navegar, Ferrostar + Valhalla recalculan desde las mismas coordenadas; las calles elegidas pueden variar. TomTom calcula como automóvil (sin restricciones específicas de bus o faena). La IA queda fuera de esta etapa.</p></div>
      </section>
      <section className="ops-route-demo__map-section" aria-label="Mapa y ruta">
        <div className="ops-route-demo__map-topline"><div><span className="ops-route-demo__eyebrow">{activeView === "planning" ? "MAPA DE PLANIFICACIÓN" : "NAVEGACIÓN DEL CONDUCTOR"}</span><strong>{selectedContract?.contract_name ?? "Calama, Región de Antofagasta"}</strong></div><div className="ops-route-demo__map-legend"><span><i className="is-start" />Inicio</span><span><i className="is-stop" />Parada</span><span><i className="is-end" />Destino</span></div></div>
        <div className={`ops-route-demo__map-frame${mapPickingStopId ? " is-picking" : ""}`}><div className="ops-route-demo__map-canvas" ref={mapContainerRef} />{activeView === "driver" && <ferrostar-map ref={(node) => { ferrostarMapRef.current = node; }} className="ops-route-demo__ferrostar" show-navigation-ui show-user-marker system="metric" />} {!planningRoute && !route && routeState !== "loading" && !mapPickingStopId && <div className="ops-route-demo__map-empty"><span>＋</span><strong>Tu ruta aparecerá aquí</strong><small>Agrega direcciones o carga el ejemplo de Calama.</small></div>}{mapPickingStopId && <><div className="ops-route-demo__map-center-pin" aria-hidden="true"><svg viewBox="0 0 28 36"><path d="M14 1C6.82 1 1 6.82 1 14c0 9.1 13 21 13 21s13-11.9 13-21C27 6.82 21.18 1 14 1Z" /><circle cx="14" cy="14" r="4.5" /></svg></div><div className="ops-route-demo__map-pick-hint" role="status">Mueve el mapa hasta ubicar el punto bajo el marcador</div><div className="ops-route-demo__map-pick-actions"><button type="button" className="ops-route-demo__primary" onClick={confirmMapPick}>Usar este punto</button><button type="button" className="ops-route-demo__secondary" onClick={() => setMapPickingStopId(null)}>Cancelar</button></div></>}{routeState === "loading" && <div className="ops-route-demo__map-loading">Calculando ruta…</div>}</div>
        <div className="ops-route-demo__map-foot"><span><i /> Planificación TomTom © TomTom · conductor Ferrostar + Valhalla</span><span>Mapa © OpenStreetMap contributors</span></div>
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
        {search.status === "ready" && search.results.map((result) => <button type="button" role="option" key={result.id ?? result.label} onClick={() => { void selectSuggestion(search.id, result); }}>{result.label}</button>)}
        {search.status === "ready" && search.results.length === 0 && <div className="ops-route-demo__suggestion-hint" role="status">No encontramos coincidencias. Prueba con calle y ciudad; presiona Enter para reintentar.</div>}
        {search.status === "error" && <div className="ops-route-demo__suggestion-hint" role="alert">No se pudo consultar TomTom. {search.error} Presiona Enter para reintentar.</div>}
      </div>,
      document.body
    )}
  </main>;
}
