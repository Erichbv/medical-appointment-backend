import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Appointment } from "../../domain/entities/Appointment.js";
import { getDynamoClient } from "./dynamoClient.js";

const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE!;

export class AppointmentDynamoRepository {
  private readonly client = getDynamoClient();

  async createPending(appointment: Appointment): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: APPOINTMENTS_TABLE,
        Item: {
          insuredId: appointment.insuredId,
          appointmentId: appointment.appointmentId,
          scheduleId: appointment.scheduleId,
          countryISO: appointment.countryISO,
          status: appointment.status,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        },
      })
    );
  }

  async findByInsuredId(insuredId: string): Promise<Appointment[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: APPOINTMENTS_TABLE,
        KeyConditionExpression: "insuredId = :insuredId",
        ExpressionAttributeValues: {
          ":insuredId": insuredId,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items.map(
      (item) =>
        new Appointment(
          item.appointmentId,
          item.insuredId,
          item.scheduleId,
          item.countryISO,
          item.status,
          item.createdAt,
          item.updatedAt
        )
    );
  }

  async markCompleted(appointmentId: string, insuredId: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: APPOINTMENTS_TABLE,
        Key: {
          insuredId,
          appointmentId,
        },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "completed",
          ":updatedAt": new Date().toISOString(),
        },
      })
    );
  }
}

