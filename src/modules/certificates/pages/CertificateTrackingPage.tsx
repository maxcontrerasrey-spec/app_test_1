import { useState } from "react";

import statusAlertIcon from "../../../assets/status-alert.png";
import statusPendingProcessIcon from "../../../assets/status-pending.png";
import statusErrorIcon from "../../../assets/status-error.png";
import statusSuccessIcon from "../../../assets/status-success.png";

const statusMeta = {
  Pendiente: statusAlertIcon,
  "En proceso": statusPendingProcessIcon,
  Generado: statusSuccessIcon,
  Error: statusErrorIcon
} as const;

const mockRows = [
  {
    folio: "1704202618491000",
    trabajador: "Acevedo Jofre Jorge Andres",
    instructor: "Gilberto Leonardo Urtubia Carvajal",
    marca: "MERCEDES BENZ",
    modelo: "O500 RS - OC500 RF",
    estado: "Pendiente"
  },
  {
    folio: "1704202619011001",
    trabajador: "Andrade Zamora Marcelo Antonio",
    instructor: "Marcelo Camilo Barrera Acevedo",
    marca: "MAXUS",
    modelo: "E DELIBERY 9",
    estado: "En proceso"
  },
  {
    folio: "1704202619141002",
    trabajador: "Abarca Vivar Juan Agustin",
    instructor: "Daniel Rodrigo Carvajal Bucarey",
    marca: "SCANIA",
    modelo: "K 440 IB",
    estado: "Generado"
  },
  {
    folio: "1704202619261003",
    trabajador: "Alvarez Vergara Pablo Esteban",
    instructor: "Gilberto Leonardo Urtubia Carvajal",
    marca: "VOLARE",
    modelo: "Fly W9 Agrale MA 9.2",
    estado: "Error"
  },
  {
    folio: "1704202619381004",
    trabajador: "Araya Figueroa Cristian Eduardo",
    instructor: "Daniel Rodrigo Carvajal Bucarey",
    marca: "IVECO",
    modelo: "DAILY 50 - 170 4X2",
    estado: "Pendiente"
  },
  {
    folio: "1704202619441005",
    trabajador: "Bravo Cisternas Luis Alberto",
    instructor: "Marcelo Camilo Barrera Acevedo",
    marca: "MERCEDES BENZ",
    modelo: "SPRINTER 315 - 415 - 515 - 517 4X2",
    estado: "En proceso"
  },
  {
    folio: "1704202619521006",
    trabajador: "Castillo Mella Diego Ignacio",
    instructor: "Gilberto Leonardo Urtubia Carvajal",
    marca: "VOLVO",
    modelo: "B 450R",
    estado: "Generado"
  }
];

const statusCounts = mockRows.reduce<Record<string, number>>((accumulator, row) => {
  accumulator[row.estado] = (accumulator[row.estado] ?? 0) + 1;
  return accumulator;
}, {});

export function CertificateTrackingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredRows = mockRows.filter((row) => {
    const matchesSearch =
      !normalizedSearchTerm ||
      row.folio.toLowerCase().includes(normalizedSearchTerm) ||
      row.trabajador.toLowerCase().includes(normalizedSearchTerm);

    const matchesStatus = !activeStatusFilter || row.estado === activeStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <section className="page">
      <div className="hero-panel">
        <h2>Seguimiento de Certificados</h2>
      </div>

      <section className="tracking-panel">
        <div className="tracking-kpi-row">
          {["Pendiente", "En proceso", "Generado", "Error"].map((status) => (
            <button
              key={status}
              type="button"
              className={`tracking-kpi-card tracking-kpi-card-${status
                .toLowerCase()
                .replace(/\s+/g, "-")} ${
                activeStatusFilter === status ? "tracking-kpi-card-active" : ""
              }`}
              onClick={() =>
                setActiveStatusFilter((current) => (current === status ? null : status))
              }
            >
              <span className="micro-label">{status}</span>
              <strong>{statusCounts[status] ?? 0}</strong>
            </button>
          ))}
        </div>

        <div className="tracking-toolbar">
          <div className="tracking-toolbar-copy">
            <h3>Resumen de Solicitudes</h3>
            {activeStatusFilter ? (
              <span className="tracking-filter-caption">
                Filtrando por estado: {activeStatusFilter}
              </span>
            ) : null}
          </div>
          <div className="tracking-filters">
            <input
              className="text-field tracking-search"
              placeholder="Buscar por folio o trabajador"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="tracking-table-wrap">
          <div className="tracking-table-scroll">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Trabajador</th>
                  <th>Instructor</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.folio}>
                      <td>{row.folio}</td>
                      <td>{row.trabajador}</td>
                      <td>{row.instructor}</td>
                      <td>{row.marca}</td>
                      <td>{row.modelo}</td>
                      <td>
                        <span className="tracking-status-pill">
                          <img
                            alt=""
                            className="tracking-status-icon"
                            src={statusMeta[row.estado as keyof typeof statusMeta]}
                          />
                          <span>{row.estado}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="tracking-empty-state" colSpan={6}>
                      No hay coincidencias para esa busqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}
