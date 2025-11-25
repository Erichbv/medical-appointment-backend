import type { SQSEvent, SQSRecord } from "aws-lambda";
import { Appointment } from "../../../domain/entities/Appointment.js";
import { AppointmentMySQLRepository } from "../../../infrastructure/rds/AppointmentMySQLRepository.js";
import { getPrismaClClient } from "../../../infrastructure/rds/prisma/clientCl.js";
import { AppointmentCompletedPublisher } from "../../../infrastructure/messaging/eventbridge/AppointmentCompletedPublisher.js";
import { PublishAppointmentCompletedUseCase } from "../../../application/usecases/PublishAppointmentCompletedUseCase.js";

export const main = async (event: SQSEvent): Promise<{ statusCode: number }> => {
  if (!event.Records) {
    console.log("⚠️ [appointmentCl] No hay records en el evento SQS");
    return { statusCode: 200 };
  }

  console.log("📥 [appointmentCl] Procesando evento SQS:", {
    recordCount: event.Records.length,
    records: event.Records.map((r: SQSRecord) => ({
      messageId: r.messageId,
      eventSourceARN: r.eventSourceARN,
    })),
  });

  for (const record of event.Records) {
    try {
      console.log("📨 [appointmentCl] Procesando record:", {
        messageId: record.messageId,
        bodyPreview: record.body.substring(0, 200),
      });

      // SNS in the message in a notification object
      const snsMessage = JSON.parse(record.body);
      console.log("📦 [appointmentCl] Mensaje SNS parseado:", {
        snsMessageKeys: Object.keys(snsMessage),
        hasMessage: !!snsMessage.Message,
        hasMessageAttributes: !!snsMessage.MessageAttributes,
        messageAttributes: snsMessage.MessageAttributes,
      });

      // The real message is in the Message field
      const body = JSON.parse(snsMessage.Message);
      console.log("📊 [appointmentCl] Datos de la cita extraídos:", {
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

      const prismaCl = getPrismaClClient();
      const repo = new AppointmentMySQLRepository(prismaCl);
      const eventPublisher = new AppointmentCompletedPublisher();
      const useCase = new PublishAppointmentCompletedUseCase(eventPublisher);

      console.log("💾 [appointmentCl] Guardando cita en RDS CL...");
      await repo.saveToRds(appointment);
      console.log("✅ [appointmentCl] Cita guardada en RDS CL");

      // if the publication is successful, continue
      try {
        console.log("📨 [appointmentCl] Publicando evento de cita completada...");
        await useCase.execute(appointment);
        console.log("✅ [appointmentCl] Evento publicado exitosamente");
      } catch (eventError) {
        console.error("⚠️ [appointmentCl] Error publicando evento (no crítico):", {
          error: eventError instanceof Error ? eventError.message : String(eventError),
          appointmentId: appointment.appointmentId,
        });
      }
    } catch (error) {
      console.error("❌ [appointmentCl] Error procesando record SQS:", {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        recordBody: record.body,
        messageId: record.messageId,
      });
    }
  }

  console.log("✅ [appointmentCl] Procesamiento de evento SQS completado");
  return { statusCode: 200 };
};

