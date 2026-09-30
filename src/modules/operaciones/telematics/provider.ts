export type ExternalVehicle = {
  externalVehicleId: string;
  externalDeviceId?: string | null;
  label?: string | null;
};

export type VehiclePosition = {
  provider: "tracktec" | "mock";
  externalVehicleId: string;
  externalEventId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  receivedAt: string;
  speedKph?: number | null;
  headingDegrees?: number | null;
  ignition?: boolean | null;
  odometerKm?: number | null;
  accuracyM?: number | null;
  eventType?: string | null;
  rawReference?: string | null;
};

export type ProviderHealth = {
  provider: "tracktec" | "mock";
  available: boolean;
  checkedAt: string;
  detail: string;
};

export interface TelematicsProvider {
  getVehicles(): Promise<ExternalVehicle[]>;
  getLatestPosition(externalVehicleId: string): Promise<VehiclePosition | null>;
  getPositions(externalVehicleId: string, from: Date, to: Date): Promise<VehiclePosition[]>;
  healthCheck(): Promise<ProviderHealth>;
}

/** Deterministic in-memory provider for local development and contract tests only. */
export class MockTelematicsProvider implements TelematicsProvider {
  constructor(private readonly positions: VehiclePosition[] = []) {
    if (positions.some((position) => position.provider !== "mock")) {
      throw new Error("MockTelematicsProvider solo acepta eventos con provider=mock.");
    }
  }

  async getVehicles(): Promise<ExternalVehicle[]> {
    return [...new Set(this.positions.map((position) => position.externalVehicleId))]
      .sort()
      .map((externalVehicleId) => ({ externalVehicleId }));
  }

  async getLatestPosition(externalVehicleId: string): Promise<VehiclePosition | null> {
    const positions = await this.getPositions(externalVehicleId, new Date(0), new Date("9999-12-31T23:59:59.999Z"));
    return positions[positions.length - 1] ?? null;
  }

  async getPositions(externalVehicleId: string, from: Date, to: Date): Promise<VehiclePosition[]> {
    return this.positions
      .filter((position) => position.externalVehicleId === externalVehicleId)
      .filter((position) => {
        const recordedAt = Date.parse(position.recordedAt);
        return Number.isFinite(recordedAt) && recordedAt >= from.getTime() && recordedAt <= to.getTime();
      })
      .slice()
      .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { provider: "mock", available: true, checkedAt: new Date().toISOString(), detail: "Proveedor simulado; no es evidencia GPS real." };
  }
}

/** Real TrackTec transport is intentionally unavailable until Atlas receives its official API contract and server credentials. */
export class TrackTecProvider implements TelematicsProvider {
  private unavailable(): never {
    throw new Error("TrackTec está deshabilitado: falta documentar y configurar su contrato técnico oficial.");
  }

  async getVehicles(): Promise<ExternalVehicle[]> { return this.unavailable(); }
  async getLatestPosition(_externalVehicleId: string): Promise<VehiclePosition | null> { return this.unavailable(); }
  async getPositions(_externalVehicleId: string, _from: Date, _to: Date): Promise<VehiclePosition[]> { return this.unavailable(); }
  async healthCheck(): Promise<ProviderHealth> {
    return { provider: "tracktec", available: false, checkedAt: new Date().toISOString(), detail: "Deshabilitado hasta completar contrato oficial y credenciales server-side." };
  }
}
