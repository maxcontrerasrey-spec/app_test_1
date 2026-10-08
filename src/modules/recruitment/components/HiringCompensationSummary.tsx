type HiringCompensationSummaryProps = {
  salaryOffer?: number | null;
  accommodationRequired?: boolean | null;
  accommodationType?: "pension" | "mining_camp" | null;
  travelRequired?: boolean | null;
  travelMethodology?: string | null;
  travelAllowanceAmount?: number | null;
};

function formatClp(value: number | null | undefined) {
  return value == null ? "—" : "$" + value.toLocaleString("es-CL");
}

export function HiringCompensationSummary({
  salaryOffer,
  accommodationRequired,
  accommodationType,
  travelRequired,
  travelMethodology,
  travelAllowanceAmount
}: HiringCompensationSummaryProps) {
  const accommodationLabel = !accommodationRequired
    ? "No"
    : accommodationType === "pension"
      ? "Sí · Pensión"
      : accommodationType === "mining_camp"
        ? "Sí · Campamento Minero"
        : "Sí · Tipo no especificado";
  const travelLabel = !travelRequired
    ? "No"
    : travelMethodology === "travel_allowance"
      ? `Bono de traslado · ${formatClp(travelAllowanceAmount)}`
      : travelMethodology === "company_purchase"
        ? "Compra Empresa"
        : "Sí · Modalidad sin definir";

  return (
    <div className="expanded-detail-fields">
      <div>
        <small>Renta líquida ofrecida</small>
        <strong>{formatClp(salaryOffer)}</strong>
      </div>
      <div>
        <small>Alojamiento</small>
        <strong>{accommodationLabel}</strong>
      </div>
      <div>
        <small>Pasajes</small>
        <strong>{travelLabel}</strong>
      </div>
    </div>
  );
}
