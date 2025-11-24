import type { AppointmentCompletedEvent } from "../events/AppointmentCompletedEvent.js";

// Dynamic import for CommonJS module
let EventBridgeClient: any = null;

const getEventBridgeClient = async (): Promise<any> => {
  if (!EventBridgeClient) {
    const AWS = await import("aws-sdk");
    EventBridgeClient = AWS.EventBridge;
  }
  return new EventBridgeClient();
};

const publishAppointmentCompletedEvent = async (
  event: AppointmentCompletedEvent
): Promise<void> => {
  const client = await getEventBridgeClient();

  await client
    .putEvents({
      Entries: [
        {
          Source: "appointment.service",
          DetailType: "AppointmentCompleted",
          Detail: JSON.stringify(event),
        },
      ],
    })
    .promise();
};

export { publishAppointmentCompletedEvent };

