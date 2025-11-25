import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { Appointment } from "../../../domain/entities/Appointment.js";

let snsClient: SNSClient | null = null;

function getSNSClient(): SNSClient {
  if (!snsClient) {
    snsClient = new SNSClient({});
  }
  return snsClient;
}

export class AppointmentRequestedPublisher {
  private readonly client = getSNSClient();
  private readonly topicArn: string;

  constructor() {
    const topicArn = process.env.SNS_TOPIC_ARN;
    if (!topicArn) {
      throw new Error("SNS_TOPIC_ARN environment variable is not set");
    }
    this.topicArn = topicArn;
  }

  async publish(appointment: Appointment): Promise<void> {
    const message = JSON.stringify({
      appointmentId: appointment.appointmentId,
      insuredId: appointment.insuredId,
      scheduleId: appointment.scheduleId,
      countryISO: appointment.countryISO,
    });

    const messageAttributes = {
      countryISO: {
        DataType: "String",
        StringValue: appointment.countryISO,
      },
    };

    console.log("[SNS Publisher] Preparando publicación a SNS:", {
      topicArn: this.topicArn,
      appointmentId: appointment.appointmentId,
      insuredId: appointment.insuredId,
      countryISO: appointment.countryISO,
      message: message,
      messageAttributes: messageAttributes,
    });

    try {
      const result = await this.client.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: message,
          MessageAttributes: messageAttributes,
        })
      );

      console.log("[SNS Publisher] Mensaje publicado exitosamente a SNS:", {
        messageId: result.MessageId,
        topicArn: this.topicArn,
        appointmentId: appointment.appointmentId,
        countryISO: appointment.countryISO,
        sequenceNumber: result.SequenceNumber,
      });
    } catch (error) {
      console.error("[SNS Publisher] Error al publicar mensaje a SNS:", {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        topicArn: this.topicArn,
        appointmentId: appointment.appointmentId,
        countryISO: appointment.countryISO,
        messageAttributes: messageAttributes,
      });
      throw error;
    }
  }
}

