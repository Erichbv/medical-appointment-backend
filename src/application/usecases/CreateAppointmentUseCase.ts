import { v4 as uuidv4 } from "uuid";
import { Appointment } from "../../domain/entities/Appointment.js";
import type { CreateAppointmentRequestDTO } from "../../interfaces/http/dto/CreateAppointmentRequestDTO.js";
import type { AppointmentDynamoRepository } from "../../infrastructure/dynamodb/AppointmentDynamoRepository.js";
import type { AppointmentRequestedPublisher } from "../../infrastructure/messaging/sns/AppointmentRequestedPublisher.js";

export class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: AppointmentDynamoRepository,
    private readonly publisher: AppointmentRequestedPublisher
  ) {}

  async execute(request: CreateAppointmentRequestDTO): Promise<Appointment> {
    const appointmentId = uuidv4();
    const now = new Date().toISOString();

    console.log("🔄 [CreateAppointmentUseCase] Iniciando creación de cita:", {
      appointmentId,
      insuredId: request.insuredId,
      scheduleId: request.scheduleId,
      countryISO: request.countryISO,
    });

    const appointment = new Appointment(
      appointmentId,
      request.insuredId,
      request.scheduleId,
      request.countryISO,
      "pending",
      now,
      now
    );

    try {
      console.log("💾 [CreateAppointmentUseCase] Guardando cita en DynamoDB...");
      await this.appointmentRepo.createPending(appointment);
      console.log("✅ [CreateAppointmentUseCase] Cita guardada en DynamoDB:", {
        appointmentId: appointment.appointmentId,
      });

      console.log("📨 [CreateAppointmentUseCase] Publicando mensaje a SNS...");
      await this.publisher.publish(appointment);
      console.log("✅ [CreateAppointmentUseCase] Mensaje publicado a SNS exitosamente");

      return appointment;
    } catch (error) {
      console.error("❌ [CreateAppointmentUseCase] Error en el proceso:", {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        appointmentId: appointment.appointmentId,
      });
      throw error;
    }
  }
}

