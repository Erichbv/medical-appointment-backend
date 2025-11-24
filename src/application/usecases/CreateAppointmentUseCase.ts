import { v4 as uuidv4 } from "uuid";
import { Appointment } from "../../domain/entities/Appointment.js";
import type { AppointmentWriteRepository } from "../../domain/repositories/AppointmentWriteRepository.js";
import type { CreateAppointmentRequestDTO } from "../../interfaces/http/dto/CreateAppointmentRequestDTO.js";

export interface AppointmentPublisher {
  publish(appointment: Appointment): Promise<void>;
}

export class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentWriteRepository: AppointmentWriteRepository,
    private readonly appointmentPublisher: AppointmentPublisher
  ) {}

  async execute(request: CreateAppointmentRequestDTO): Promise<Appointment> {
    const appointmentId = uuidv4();
    const now = new Date().toISOString();

    const appointment = new Appointment(
      appointmentId,
      request.insuredId,
      request.scheduleId,
      request.countryISO,
      "pending",
      now,
      now
    );

    return appointment;
  }
}

