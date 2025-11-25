import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AppointmentDynamoRepository } from "../../../infrastructure/dynamodb/AppointmentDynamoRepository.js";
import { AppointmentRequestedPublisher } from "../../../infrastructure/messaging/sns/AppointmentRequestedPublisher.js";
import { CreateAppointmentUseCase } from "../../../application/usecases/CreateAppointmentUseCase.js";
import { GetAppointmentsByInsuredUseCase } from "../../../application/usecases/GetAppointmentsByInsuredUseCase.js";
import { CompleteAppointmentUseCase } from "../../../application/usecases/CompleteAppointmentUseCase.js";
import { createAppointmentSchema } from "../../http/validators/createAppointmentValidator.js";
import type { CreateAppointmentRequestDTO } from "../../http/dto/CreateAppointmentRequestDTO.js";

export const main = async (event: any): Promise<APIGatewayProxyResult | void> => {
  // Handle SQS events
  if (event.Records && Array.isArray(event.Records)) {
    try {
      const appointmentRepo = new AppointmentDynamoRepository();
      const completeAppointmentUseCase = new CompleteAppointmentUseCase(appointmentRepo);

      console.log("📥 [Handler] Procesando evento SQS:", {
        recordCount: event.Records.length,
        records: event.Records.map((r: any) => ({
          messageId: r.messageId,
          receiptHandle: r.receiptHandle?.substring(0, 20) + "...",
          bodyPreview: typeof r.body === "string" ? r.body.substring(0, 200) : JSON.stringify(r.body).substring(0, 200),
        })),
      });

      // Process each SQS record
      for (const record of event.Records) {
        try {
          console.log("📨 [Handler] Procesando record SQS:", {
            messageId: record.messageId,
            eventSource: record.eventSource,
            eventSourceARN: record.eventSourceARN,
          });

          // Parse JSON from record.body
          const body = typeof record.body === "string" ? JSON.parse(record.body) : record.body;
          
          console.log("📋 [Handler] Body parseado del record:", {
            bodyKeys: Object.keys(body),
            hasDetail: !!body.detail,
            hasMessage: !!body.Message,
          });
          
          // EventBridge sends messages to SQS with the format:
          // { "source": "...", "detail-type": "...", "detail": "{\"appointmentId\":\"...\",...}" }
          // The detail field contains the JSON stringified
          let appointmentData;
          if (body.detail) {
            // EventBridge message - parse the detail
            appointmentData = typeof body.detail === "string" ? JSON.parse(body.detail) : body.detail;
            console.log("📦 [Handler] Mensaje de EventBridge detectado");
          } else if (body.Message) {
            // SNS message format
            appointmentData = typeof body.Message === "string" ? JSON.parse(body.Message) : body.Message;
            console.log("📦 [Handler] Mensaje de SNS detectado");
          } else {
            // Direct message (fallback)
            appointmentData = body;
            console.log("📦 [Handler] Mensaje directo detectado");
          }
          
          console.log("📊 [Handler] Datos de la cita extraídos:", {
            appointmentId: appointmentData.appointmentId,
            insuredId: appointmentData.insuredId,
            countryISO: appointmentData.countryISO,
          });
          
          const { appointmentId, insuredId } = appointmentData;

          if (!appointmentId || !insuredId) {
            console.error("❌ [Handler] Faltan campos requeridos en el mensaje SQS:", { appointmentId, insuredId, fullData: appointmentData });
            continue;
          }

          console.log("🔄 [Handler] Ejecutando CompleteAppointmentUseCase...");
          // Execute use case
          await completeAppointmentUseCase.execute(appointmentId, insuredId);
          console.log("✅ [Handler] Cita completada exitosamente:", { appointmentId, insuredId });
        } catch (error) {
          console.error("❌ [Handler] Error procesando record SQS:", {
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            recordBody: record.body,
            messageId: record.messageId,
          });
        }
      }

      // SQS handlers don't require HTTP response, but we can return a simple OK
      return { statusCode: 200, body: JSON.stringify({ message: "OK" }) };
    } catch (error) {
      console.error("Error procesando evento SQS:", error);
      return { statusCode: 200, body: JSON.stringify({ message: "OK" }) };
    }
  }

  // Handle HTTP events (API Gateway)
  if (event.httpMethod) {
    const httpMethod = event.httpMethod;
    const path = event.path || "";
    const pathParameters = event.pathParameters || {};

    // POST /appointments - create appointment
    if (httpMethod === "POST" && path.includes("/appointments")) {
      try {
        // parse body JSON
        let body: CreateAppointmentRequestDTO;
        try {
          body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        } catch (error) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: "Cuerpo de la solicitud inválido" }),
          };
        }

        // validate using createAppointmentValidator
        const { error, value } = createAppointmentSchema.validate(body, {
          abortEarly: false,
        });

        if (error) {
          const errorMessages = error.details.map((detail) => detail.message).join(", ");
          return {
            statusCode: 400,
            body: JSON.stringify({ message: `Error de validación: ${errorMessages}` }),
          };
        }

        // instantiate repository and publisher
        const appointmentRepo = new AppointmentDynamoRepository();
        const publisher = new AppointmentRequestedPublisher();

        // instantiate use case
        const createAppointmentUseCase = new CreateAppointmentUseCase(
          appointmentRepo,
          publisher
        );

        console.log("🚀 [Handler] Iniciando creación de cita desde API:", {
          insuredId: value.insuredId,
          scheduleId: value.scheduleId,
          countryISO: value.countryISO,
        });

        // Ejecutar caso de uso
        const appointment = await createAppointmentUseCase.execute(value);

        console.log("✅ [Handler] Cita creada exitosamente:", {
          appointmentId: appointment.appointmentId,
          status: appointment.status,
        });

        // return successful response
        return {
          statusCode: 201,
          body: JSON.stringify({
            message: "Cita registrada y en proceso de agendamiento",
            appointmentId: appointment.appointmentId,
            status: "pending",
          }),
        };
      } catch (error) {
        console.error("Error al crear cita:", error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Error interno del servidor al procesar la solicitud",
          }),
        };
      }
    }

    // GET /appointments/{insuredId} - get appointments by insuredId
    if (httpMethod === "GET" && path.includes("/appointments/")) {
      try {
        // read insuredId from pathParameters
        const insuredId = pathParameters.insuredId;

        if (!insuredId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: "El parámetro insuredId es requerido" }),
          };
        }

        // instantiate repository
        const appointmentRepo = new AppointmentDynamoRepository();

        // instantiate use case
        const getAppointmentsUseCase = new GetAppointmentsByInsuredUseCase(
          appointmentRepo
        );

        // execute use case
        const appointments = await getAppointmentsUseCase.execute(insuredId);

        // return list of appointments
        return {
          statusCode: 200,
          body: JSON.stringify(appointments),
        };
      } catch (error) {
        console.error("Error al obtener citas:", error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Error interno del servidor al obtener las citas",
          }),
        };
      }
    }

    // unsupported route
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Ruta no encontrada" }),
    };
  }

  // Event type not supported
  return {
    statusCode: 400,
    body: JSON.stringify({ message: "Evento no soportado" }),
  };
};

