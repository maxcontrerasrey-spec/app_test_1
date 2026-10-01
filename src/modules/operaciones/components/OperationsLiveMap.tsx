import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { AtlasDispatch, AtlasVehiclePosition } from "../services/atlasOperationsApi";
import "leaflet/dist/leaflet.css";

const CHILE_CENTER: [number, number] = [-33.45, -70.66];

function FitPositions({ positions }: { positions: AtlasVehiclePosition[] }) {
  const map = useMap();
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const vehicleKey = positions.map((position) => position.vehicle_id).sort().join("\u001f");
  useEffect(() => {
    const currentPositions = positionsRef.current;
    if (currentPositions.length === 1) {
      map.setView([currentPositions[0].latitude, currentPositions[0].longitude], 12, { animate: false });
    } else if (currentPositions.length > 1) {
      const bounds: LatLngBoundsExpression = currentPositions.map(({ latitude, longitude }) => [latitude, longitude]);
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 12, animate: false });
    }
  }, [map, vehicleKey]);
  return null;
}

export function OperationsLiveMap({
  dispatches,
  positions,
  loading,
  positionError,
  onSelectDispatch,
  onPlan
}: {
  dispatches: AtlasDispatch[];
  positions: AtlasVehiclePosition[];
  loading: boolean;
  positionError: string;
  onSelectDispatch: (id: string) => void;
  onPlan: () => void;
}) {
  const dispatchesByVehicle = dispatches.reduce((groups, dispatch) => {
    if (!dispatch.vehicle_id) return groups;
    const assigned = groups.get(dispatch.vehicle_id) ?? [];
    assigned.push(dispatch);
    groups.set(dispatch.vehicle_id, assigned);
    return groups;
  }, new Map<string, AtlasDispatch[]>());
  const located = positions.filter((position) => dispatchesByVehicle.has(position.vehicle_id));

  return <section className="atlas-ops__map-workspace" aria-label="Mapa y servicios del día">
    <div className="atlas-ops__map-panel">
      <div className="atlas-ops__map-heading">
        <div><strong>Mapa en vivo</strong><span>{loading ? "Buscando última señal GPS…" : positionError ? "No se pudo consultar la telemetría" : `${located.length} de ${dispatchesByVehicle.size} vehículos con señal`}</span></div>
        <span className={`atlas-ops__map-connection${located.length ? " is-live" : ""}`}><i />{located.length ? "Telemetría disponible" : positionError ? "Consulta interrumpida" : "Sin señales GPS"}</span>
      </div>
      <div className="atlas-ops__map-canvas">
        <MapContainer center={CHILE_CENTER} zoom={5} scrollWheelZoom className="atlas-ops__leaflet-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitPositions positions={located} />
          {located.map((position) => {
            const vehicleDispatches = dispatchesByVehicle.get(position.vehicle_id);
            if (!vehicleDispatches?.length) return null;
            const riskRank = { critical: 0, at_risk: 1, attention: 2, green: 3 };
            const dispatch = [...vehicleDispatches].sort((left, right) => riskRank[left.risk_status] - riskRank[right.risk_status])[0];
            const color = dispatch.risk_status === "critical" ? "#b42318" : dispatch.risk_status === "at_risk" ? "#b54708" : dispatch.risk_status === "attention" ? "#2563a8" : "#16835d";
            return <CircleMarker
              key={position.vehicle_id}
              center={[position.latitude, position.longitude]}
              radius={8}
              pathOptions={{ color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }}
            >
              <Popup>
                <div className="atlas-ops__map-popup">
                  <strong>{dispatch.vehicle_code ?? "Vehículo"}{dispatch.plate ? ` · ${dispatch.plate}` : ""}</strong>
                  <small>Última señal: {new Date(position.observed_at).toLocaleString("es-CL")}{position.speed_kph === null ? "" : ` · ${Math.round(position.speed_kph)} km/h`}</small>
                  {vehicleDispatches.map((item) => <div className="atlas-ops__map-popup-service" key={item.id}>
                    <span>{item.service_name ?? "Servicio"} · {item.contract_code}</span>
                    <small>{item.driver_name_snapshot ?? "Conductor sin asignar"}</small>
                    <button type="button" onClick={() => onSelectDispatch(item.id)}>Abrir servicio</button>
                  </div>)}
                </div>
              </Popup>
            </CircleMarker>;
          })}
        </MapContainer>
        {!loading && located.length === 0 && <div className="atlas-ops__map-empty">
          <strong>{positionError ? "No fue posible consultar el GPS" : "El mapa está listo para recibir posiciones"}</strong>
          <span>{positionError || "Las ubicaciones aparecerán cuando TrackTec envíe telemetría y el vehículo tenga un servicio asignado."}</span>
          {dispatches.length === 0 && <button type="button" onClick={onPlan}>Programar primer servicio</button>}
        </div>}
      </div>
    </div>
    <aside className="atlas-ops__map-list" aria-label="Servicios visibles">
      <div className="atlas-ops__map-list-heading"><strong>Servicios del día</strong><span>{dispatches.length}</span></div>
      {dispatches.length === 0 ? <div className="atlas-ops__map-list-empty">Sin servicios planificados para esta fecha. Al crear uno aparecerá aquí con su estado y última señal GPS.</div> :
        dispatches.map((dispatch) => {
          const position = positions.find((item) => item.vehicle_id === dispatch.vehicle_id);
          return <button className="atlas-ops__map-service" key={dispatch.id} type="button" onClick={() => onSelectDispatch(dispatch.id)}>
            <span className={`atlas-ops__map-service-dot atlas-ops__map-service-dot--${dispatch.risk_status}`} />
            <span className="atlas-ops__map-service-copy">
              <strong>{dispatch.service_name ?? "Servicio sin nombre"}</strong>
              <small>{dispatch.planned_start_at ? new Date(dispatch.planned_start_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Hora pendiente"} · {dispatch.contract_code}</small>
              <small>{dispatch.vehicle_code ?? "Vehículo pendiente"} · {dispatch.driver_name_snapshot ?? "Conductor pendiente"}</small>
            </span>
            <span className="atlas-ops__map-gps-state">{position ? "GPS" : "—"}</span>
          </button>;
        })}
    </aside>
  </section>;
}
