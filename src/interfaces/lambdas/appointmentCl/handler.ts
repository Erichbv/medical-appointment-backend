import type { SQSEvent, SQSRecord } from "aws-lambda";
import { Appointment } from "../../../domain/entities/Appointment.js";
import type { AppointmentRequestedEvent } from "../../../infrastructure/messaging/events/AppointmentRequestedEvent.js";
import { publishAppointmentCompletedEvent } from "../../../infrastructure/messaging/eventbridge/index.js";
import { AppointmentMySQLRepository } from "../../../infrastructure/rds/AppointmentMySQLRepository.js";
import { getPrismaClClient } from "../../../infrastructure/rds/prisma/clientCl.js";

const parseSQSMessage = (record: SQSRecord): AppointmentRequestedEvent => {
  const body = JSON.parse(record.body);
  
  // Si el mensaje viene de SNS, el payload está en body.Message
  const message = body.Message ? JSON.parse(body.Message) : body;

  return {
    appointmentId: message.appointmentId,
    insuredId: message.insuredId,
    scheduleId: message.scheduleId,
    countryISO: message.countryISO,
  };
};

const buildAppointmentEntity = (
  event: AppointmentRequestedEvent
): Appointment => {
  const now = new Date().toISOString();

  return new Appointment(
    event.appointmentId,
    event.insuredId,
    event.scheduleId,
    event.countryISO,
    "pending",
    now,
    now
  );
};

const processAppointment = async (
  event: AppointmentRequestedEvent
): Promise<void> => {
  const prismaClient = getPrismaClClient();
  const repository = new AppointmentMySQLRepository(prismaClient);

  const appointment = buildAppointmentEntity(event);
  await repository.saveToRds(appointment);

  await publishAppointmentCompletedEvent({
    appointmentId: appointment.appointmentId,
    insuredId: appointment.insuredId,
    scheduleId: appointment.scheduleId,
    countryISO: appointment.countryISO,
  });
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const promises = event.Records.map(async (record) => {
    try {
      const appointmentEvent = parseSQSMessage(record);
      await processAppointment(appointmentEvent);
    } catch (error) {
      console.error("Error processing appointment:", error);
      throw error;
    }
  });

  await Promise.all(promises);
};

