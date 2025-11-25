import type { Appointment } from "../../domain/entities/Appointment.js";
import type { AppointmentDynamoRepository } from "../../infrastructure/dynamodb/AppointmentDynamoRepository.js";

export class GetAppointmentsByInsuredUseCase {
  constructor(
    private readonly appointmentRepo: AppointmentDynamoRepository
  ) {}

  async execute(insuredId: string): Promise<Appointment[]> {
    return await this.appointmentRepo.findByInsuredId(insuredId);
  }
}

