import type { AppointmentDynamoRepository } from "../../infrastructure/dynamodb/AppointmentDynamoRepository.js";

export class CompleteAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: AppointmentDynamoRepository
  ) {}

  async execute(appointmentId: string, insuredId: string): Promise<void> {
    await this.appointmentRepo.markCompleted(appointmentId, insuredId);
  }
}

