import type { CountryISO } from "../../../domain/value-objects/CountryISO.js";

export interface AppointmentRequestedEvent {
  appointmentId: string;
  insuredId: string;
  scheduleId: number;
  countryISO: CountryISO;
}

