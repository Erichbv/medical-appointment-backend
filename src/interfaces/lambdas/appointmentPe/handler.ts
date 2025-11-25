import type { SQSEvent, SQSRecord } from "aws-lambda";
import { Appointment } from "../../../domain/entities/Appointment.js";
import { AppointmentMySQLRepository } from "../../../infrastructure/rds/AppointmentMySQLRepository.js";
import { getPrismaPeClient } from "../../../infrastructure/rds/prisma/clientPe.js";
import { AppointmentCompletedPublisher } from "../../../infrastructure/messaging/eventbridge/AppointmentCompletedPublisher.js";
import { PublishAppointmentCompletedUseCase } from "../../../application/usecases/PublishAppointmentCompletedUseCase.js";

export const main = async (event: SQSEvent): Promise<{ statusCode: number }> => {
  if (!event.Records) {
    console.log("⚠️ [appointmentPe] No hay records en el evento SQS");
    return { statusCode: 200 };
  }

  console.log("📥 [appointmentPe] Procesando evento SQS:", {
    recordCount: event.Records.length,
    records: event.Records.map((r: SQSRecord) => ({
      messageId: r.messageId,
      eventSourceARN: r.eventSourceARN,
    })),
  });

  for (const record of event.Records) {
    try {
      console.log("📨 [appointmentPe] Procesando record:", {
        messageId: record.messageId,
        bodyPreview: record.body.substring(0, 200),
      });

      // SNS envuelve el mensaje en un objeto de notificación
      const snsMessage = JSON.parse(record.body);
      console.log("📦 [appointmentPe] Mensaje SNS parseado:", {
        snsMessageKeys: Object.keys(snsMessage),
        hasMessage: !!snsMessage.Message,
        hasMessageAttributes: !!snsMessage.MessageAttributes,
        messageAttributes: snsMessage.MessageAttributes,
      });

      // El mensaje real está en el campo Message
      const body = JSON.parse(snsMessage.Message);
      console.log("📊 [appointmentPe] Datos de la cita extraídos:", {
        appointmentId: body.appointmentId,
        insuredId: body.insuredId,
        scheduleId: body.scheduleId,
        countryISO: body.countryISO,
      });
      
      const now = new Date().toISOString();
      const appointment = new Appointment(
        body.appointmentId,
        body.insuredId,
        body.scheduleId,
        body.countryISO,
        "pending",
        now,
        now
      );

      const prismaPe = getPrismaPeClient();
      const repo = new AppointmentMySQLRepository(prismaPe);
      const eventPublisher = new AppointmentCompletedPublisher();
      const useCase = new PublishAppointmentCompletedUseCase(eventPublisher);

      console.log("💾 [appointmentPe] Guardando cita en RDS PE...");
      await repo.saveToRds(appointment);
      console.log("✅ [appointmentPe] Cita guardada en RDS PE");

      console.log("📨 [appointmentPe] Publicando evento de cita completada...");
      await useCase.execute(appointment);
      console.log("✅ [appointmentPe] Evento publicado exitosamente");
    } catch (error) {
      console.error("❌ [appointmentPe] Error procesando record SQS:", {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        recordBody: record.body,
        messageId: record.messageId,
      });
      // Continuar procesando otros records aunque uno falle
      // El mensaje fallido volverá a la cola para reintento
    }
  }

  console.log("✅ [appointmentPe] Procesamiento de evento SQS completado");
  return { statusCode: 200 };
};

