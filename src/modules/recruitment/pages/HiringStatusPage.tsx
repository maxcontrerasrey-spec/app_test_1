import { useEffect, useMemo, useState } from "react";

type HiringControlRow = {
  folio: string;
  estadoSolicitud: "Pendiente" | "Aprobada" | "Rechazada" | "Cerrada";
  solicitanteNombre: string;
  cargoSolicitado: string;
  numeroVacantes: string;
  nombreContrato: string;
  gerenteArea: string;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaTermino: string;
  gerenteAreaResultado: string;
  controlContratosResultado: string;
  turno: string;
  rentaLiquidaOfrecida: string;
  otrosBeneficios: string;
  fechaIngresoEfectiva: string;
  resultadoSeguimiento: string;
  observacionInterna: string;
  comentarioProceso: string;
};

const mockRows: HiringControlRow[] = [
  {
    folio: "0001",
    estadoSolicitud: "Pendiente",
    solicitanteNombre: "Maximiliano Contreras",
    cargoSolicitado: "CONDUCTOR DE BUS",
    numeroVacantes: "2",
    nombreContrato: "CONTROL FLOTA",
    gerenteArea: "JUAN CARLOS NAVEA",
    fechaSolicitud: "18/04/2026",
    fechaInicio: "22/04/2026",
    fechaTermino: "22/07/2026",
    gerenteAreaResultado: "Pendiente",
    controlContratosResultado: "Pendiente",
    turno: "5X2",
    rentaLiquidaOfrecida: "1000000",
    otrosBeneficios: "",
    fechaIngresoEfectiva: "",
    resultadoSeguimiento: "En revision",
    observacionInterna: "",
    comentarioProceso: ""
  },
  {
    folio: "0002",
    estadoSolicitud: "Aprobada",
    solicitanteNombre: "Daniela Rojas",
    cargoSolicitado: "ANALISTA CONTABLE",
    numeroVacantes: "1",
    nombreContrato: "FACTURACION Y COBRANZAS",
    gerenteArea: "RAUL LOPEZ",
    fechaSolicitud: "18/04/2026",
    fechaInicio: "25/04/2026",
    fechaTermino: "25/07/2026",
    gerenteAreaResultado: "Aprobada",
    controlContratosResultado: "Aprobada",
    turno: "5X2",
    rentaLiquidaOfrecida: "1350000",
    otrosBeneficios: "Bono movilizacion",
    fechaIngresoEfectiva: "25/04/2026",
    resultadoSeguimiento: "Listo para ingreso",
    observacionInterna: "Documentacion completa",
    comentarioProceso: "Ingreso coordinado con jefatura"
  },
  {
    folio: "0003",
    estadoSolicitud: "Rechazada",
    solicitanteNombre: "Cristian Salgado",
    cargoSolicitado: "ADMINISTRATIVO RRHH",
    numeroVacantes: "3",
    nombreContrato: "COMERCIAL",
    gerenteArea: "ALAN BRAIN",
    fechaSolicitud: "19/04/2026",
    fechaInicio: "28/04/2026",
    fechaTermino: "28/07/2026",
    gerenteAreaResultado: "Rechazada",
    controlContratosResultado: "Pendiente",
    turno: "ART 22",
    rentaLiquidaOfrecida: "950000",
    otrosBeneficios: "",
    fechaIngresoEfectiva: "",
    resultadoSeguimiento: "Documentacion pendiente",
    observacionInterna: "Falta validacion presupuestaria",
    comentarioProceso: ""
  }
];

const statusOptions = ["Pendiente", "Aprobada", "Rechazada", "Cerrada"];
const followUpOptions = [
  "En revision",
  "Documentacion pendiente",
  "Listo para ingreso",
  "Ingreso realizado",
  "Cerrado"
];

function formatCurrencyDisplay(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("es-CL").format(Number(value));
}

function normalizeCurrencyInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  return digits ? String(Number(digits)) : "";
}

export function HiringStatusPage() {
  const [rows, setRows] = useState(mockRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [selectedFolio, setSelectedFolio] = useState(mockRows[0]?.folio ?? "");
  const [localStatus, setLocalStatus] = useState("");

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !normalizedSearchTerm ||
      row.folio.toLowerCase().includes(normalizedSearchTerm) ||
      row.solicitanteNombre.toLowerCase().includes(normalizedSearchTerm);

    const matchesStatus = !activeStatusFilter || row.estadoSolicitud === activeStatusFilter;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (filteredRows.length === 0) {
      if (selectedFolio) {
        setSelectedFolio("");
      }

      return;
    }

    const selectedRowIsVisible = filteredRows.some((row) => row.folio === selectedFolio);

    if (!selectedRowIsVisible) {
      setSelectedFolio(filteredRows[0].folio);
    }
  }, [filteredRows, selectedFolio]);

  const selectedRow =
    filteredRows.find((row) => row.folio === selectedFolio) ?? filteredRows[0] ?? null;

  const statusCounts = useMemo(
    () =>
      rows.reduce<Record<string, number>>((accumulator, row) => {
        accumulator[row.estadoSolicitud] = (accumulator[row.estadoSolicitud] ?? 0) + 1;
        return accumulator;
      }, {}),
    [rows]
  );

  const updateSelectedRow = (field: keyof HiringControlRow, value: string) => {
    if (!selectedRow) {
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.folio === selectedRow.folio ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSave = () => {
    if (!selectedRow) {
      return;
    }

    setLocalStatus(
      `Cambios del folio ${selectedRow.folio} guardados en modo local. Luego esto actualizará SharePoint.`
    );
  };

  return (
    <section className="page">
      <div className="hero-panel">
        <h2>Control de Contrataciones</h2>
      </div>

      <section className="tracking-panel">
        <div className="tracking-kpi-row">
          {statusOptions.map((status) => (
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
              placeholder="Buscar por folio o solicitante"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="control-layout">
          <div className="tracking-table-wrap">
            <div className="tracking-table-scroll">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Estado</th>
                    <th>Solicitante</th>
                    <th>Cargo</th>
                    <th>Cupos</th>
                    <th>Contrato</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => (
                      <tr
                        key={row.folio}
                        className={row.folio === selectedRow?.folio ? "tracking-row-selected" : ""}
                        onClick={() => setSelectedFolio(row.folio)}
                      >
                        <td>{row.folio}</td>
                        <td>{row.estadoSolicitud}</td>
                        <td>{row.solicitanteNombre}</td>
                        <td>{row.cargoSolicitado}</td>
                        <td>{row.numeroVacantes}</td>
                        <td>{row.nombreContrato}</td>
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

          {selectedRow ? (
            <aside className="control-detail-panel">
              <div className="control-detail-header">
                <span className="eyebrow">Folio {selectedRow.folio}</span>
                <h3>Detalle y Control</h3>
              </div>

              <div className="control-readonly-grid">
                <div>
                  <small>Solicitante</small>
                  <strong>{selectedRow.solicitanteNombre}</strong>
                </div>
                <div>
                  <small>Fecha solicitud</small>
                  <strong>{selectedRow.fechaSolicitud}</strong>
                </div>
                <div>
                  <small>Contrato</small>
                  <strong>{selectedRow.nombreContrato}</strong>
                </div>
                <div>
                  <small>Gerente area</small>
                  <strong>{selectedRow.gerenteArea}</strong>
                </div>
                <div>
                  <small>Aprobacion gerente</small>
                  <strong>{selectedRow.gerenteAreaResultado}</strong>
                </div>
                <div>
                  <small>Control de contratos</small>
                  <strong>{selectedRow.controlContratosResultado}</strong>
                </div>
              </div>

              <div className="control-edit-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="estado-solicitud">
                    Estado solicitud
                  </label>
                  <select
                    id="estado-solicitud"
                    className="text-field"
                    value={selectedRow.estadoSolicitud}
                    onChange={(event) => updateSelectedRow("estadoSolicitud", event.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="turno-control">
                    Turno
                  </label>
                  <input
                    id="turno-control"
                    className="text-field"
                    value={selectedRow.turno}
                    onChange={(event) => updateSelectedRow("turno", event.target.value)}
                    type="text"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="fecha-inicio-control">
                    Fecha inicio
                  </label>
                  <input
                    id="fecha-inicio-control"
                    className="text-field"
                    value={selectedRow.fechaInicio}
                    onChange={(event) => updateSelectedRow("fechaInicio", event.target.value)}
                    type="text"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="fecha-termino-control">
                    Fecha termino
                  </label>
                  <input
                    id="fecha-termino-control"
                    className="text-field"
                    value={selectedRow.fechaTermino}
                    onChange={(event) => updateSelectedRow("fechaTermino", event.target.value)}
                    type="text"
                  />
                </div>

                <div className="field-group field-with-suffix">
                  <label className="field-label" htmlFor="renta-control">
                    Renta liquida ofrecida
                  </label>
                  <input
                    id="renta-control"
                    className="text-field text-field-with-suffix"
                    inputMode="numeric"
                    value={formatCurrencyDisplay(selectedRow.rentaLiquidaOfrecida)}
                    onChange={(event) =>
                      updateSelectedRow(
                        "rentaLiquidaOfrecida",
                        normalizeCurrencyInput(event.target.value)
                      )
                    }
                    type="text"
                  />
                  <span className="field-suffix">$</span>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="fecha-ingreso-efectiva">
                    Fecha ingreso efectiva
                  </label>
                  <input
                    id="fecha-ingreso-efectiva"
                    className="text-field"
                    value={selectedRow.fechaIngresoEfectiva}
                    onChange={(event) =>
                      updateSelectedRow("fechaIngresoEfectiva", event.target.value)
                    }
                    placeholder="Pendiente"
                    type="text"
                  />
                </div>

                <div className="field-group control-span-full">
                  <label className="field-label" htmlFor="resultado-seguimiento">
                    Resultado seguimiento
                  </label>
                  <select
                    id="resultado-seguimiento"
                    className="text-field"
                    value={selectedRow.resultadoSeguimiento}
                    onChange={(event) =>
                      updateSelectedRow("resultadoSeguimiento", event.target.value)
                    }
                  >
                    {followUpOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group control-span-full">
                  <label className="field-label" htmlFor="otros-beneficios-control">
                    Otros beneficios
                  </label>
                  <textarea
                    id="otros-beneficios-control"
                    className="text-field text-area-field"
                    value={selectedRow.otrosBeneficios}
                    onChange={(event) =>
                      updateSelectedRow("otrosBeneficios", event.target.value)
                    }
                  />
                </div>

                <div className="field-group control-span-full">
                  <label className="field-label" htmlFor="observacion-interna">
                    Observacion interna
                  </label>
                  <textarea
                    id="observacion-interna"
                    className="text-field text-area-field"
                    value={selectedRow.observacionInterna}
                    onChange={(event) =>
                      updateSelectedRow("observacionInterna", event.target.value)
                    }
                  />
                </div>

                <div className="field-group control-span-full">
                  <label className="field-label" htmlFor="comentario-proceso">
                    Comentario proceso
                  </label>
                  <textarea
                    id="comentario-proceso"
                    className="text-field text-area-field"
                    value={selectedRow.comentarioProceso}
                    onChange={(event) =>
                      updateSelectedRow("comentarioProceso", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="action-row">
                <button type="button" className="soft-primary-button" onClick={handleSave}>
                  Guardar cambios
                </button>
              </div>

              {localStatus ? <p className="form-status">{localStatus}</p> : null}
            </aside>
          ) : null}
        </div>
      </section>
    </section>
  );
}
