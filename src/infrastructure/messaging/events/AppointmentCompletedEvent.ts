import type { CountryISO } from "../../../domain/value-objects/CountryISO.js";

export interface AppointmentCompletedEvent {
  appointmentId: string;
  insuredId: string;
  scheduleId: number;
  countryISO: CountryISO;
}

