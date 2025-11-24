import type { Appointment } from "../entities/Appointment.js";

export interface AppointmentReadRepository {
  findByInsuredId(insuredId: string): Promise<Appointment[]>;
}

