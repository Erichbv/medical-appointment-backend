import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from "@aws-sdk/client-eventbridge";
import type { Appointment } from "../../../domain/entities/Appointment.js";

let eventBridgeClient: EventBridgeClient | null = null;

function getEventBridgeClient(): EventBridgeClient {
  if (!eventBridgeClient) {
    eventBridgeClient = new EventBridgeClient({});
  }
  return eventBridgeClient;
}

export class AppointmentCompletedPublisher {
  private readonly client = getEventBridgeClient();
  private readonly eventBusName?: string;

  constructor() {
    this.eventBusName = process.env.EVENT_BUS_NAME;
  }

  async publish(appointment: Appointment): Promise<void> {
    const entry: PutEventsRequestEntry = {
      Source: "appointment.service",
      DetailType: "AppointmentCompleted",
      Detail: JSON.stringify({
        appointmentId: appointment.appointmentId,
        insuredId: appointment.insuredId,
        scheduleId: appointment.scheduleId,
        countryISO: appointment.countryISO,
      }),
    };

    if (this.eventBusName) {
      entry.EventBusName = this.eventBusName;
    }

    await this.client.send(
      new PutEventsCommand({
        Entries: [entry],
      })
    );
  }
}

