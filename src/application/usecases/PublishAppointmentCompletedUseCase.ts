import type { Appointment } from "../../domain/entities/Appointment.js";
import { AppointmentCompletedPublisher } from "../../infrastructure/messaging/eventbridge/AppointmentCompletedPublisher.js";

export class PublishAppointmentCompletedUseCase {
  constructor(
    private readonly publisher: AppointmentCompletedPublisher
  ) {}

  async execute(appointment: Appointment): Promise<void> {
    await this.publisher.publish(appointment);
  }
}

