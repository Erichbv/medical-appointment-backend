import type { AppointmentWriteRepository } from "../../domain/repositories/AppointmentWriteRepository.js";

export class CompleteAppointmentUseCase {
  constructor(
    private readonly appointmentWriteRepository: AppointmentWriteRepository
  ) {}

  async execute(appointmentId: string, insuredId: string): Promise<void> {
    await this.appointmentWriteRepository.markCompleted(
      appointmentId,
      insuredId
    );
  }
}

