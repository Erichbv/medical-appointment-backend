import type { Appointment } from "../../domain/entities/Appointment.js";
import type { AppointmentReadRepository } from "../../domain/repositories/AppointmentReadRepository.js";

export class GetAppointmentsByInsuredUseCase {
  constructor(
    private readonly appointmentReadRepository: AppointmentReadRepository
  ) {}

  async execute(insuredId: string): Promise<Appointment[]> {
    return await this.appointmentReadRepository.findByInsuredId(insuredId);
  }
}

