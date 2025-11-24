import type { CountryISO } from "../../../domain/value-objects/CountryISO.js";

export interface CreateAppointmentRequestDTO {
  insuredId: string;
  scheduleId: number;
  countryISO: CountryISO;
}

