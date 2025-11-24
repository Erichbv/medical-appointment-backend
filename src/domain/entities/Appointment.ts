import type { CountryISO } from "../value-objects/CountryISO.js";

export class Appointment {
  appointmentId: string;
  insuredId: string;
  scheduleId: number;
  countryISO: CountryISO;
  status: "pending" | "completed";
  createdAt: string;
  updatedAt: string;

  constructor(
    appointmentId: string,
    insuredId: string,
    scheduleId: number,
    countryISO: CountryISO,
    status: "pending" | "completed",
    createdAt: string,
    updatedAt: string
  ) {
    this.appointmentId = appointmentId;
    this.insuredId = insuredId;
    this.scheduleId = scheduleId;
    this.countryISO = countryISO;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

