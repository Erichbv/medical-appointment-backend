import type { Appointment } from "../entities/Appointment.js";

export interface AppointmentWriteRepository {
  createPending(appointment: Appointment): Promise<void>;
  markCompleted(appointmentId: string, insuredId: string): Promise<void>;
}

