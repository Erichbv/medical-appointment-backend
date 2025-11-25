import { main } from "../handler.js";
import { Appointment } from "../../../../domain/entities/Appointment.js";

type APIGatewayProxyEvent = {
  httpMethod?: string;
  path?: string;
  body?: string;
  pathParameters?: Record<string, string>;
  Records?: unknown[];
};

// Mock of AppointmentDynamoRepository
jest.mock("../../../../infrastructure/dynamodb/AppointmentDynamoRepository.js", () => {
  return {
    AppointmentDynamoRepository: jest.fn().mockImplementation(() => ({
      createPending: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Mock of AppointmentRequestedPublisher
jest.mock("../../../../infrastructure/messaging/sns/AppointmentRequestedPublisher.js", () => {
  return {
    AppointmentRequestedPublisher: jest.fn().mockImplementation(() => ({
      publish: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Mock of CreateAppointmentUseCase
jest.mock("../../../../application/usecases/CreateAppointmentUseCase.js", () => {
  return {
    CreateAppointmentUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
  };
});

import { CreateAppointmentUseCase } from "../../../../application/usecases/CreateAppointmentUseCase.js";

describe("Handler - POST /appointments", () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute = jest.fn();
    (CreateAppointmentUseCase as jest.Mock).mockImplementation(() => ({
      execute: mockExecute,
    }));
  });

  describe("POST /appointments", () => {
    it("should return 201 and create appointment on POST /appointments", async () => {
      // Arrange
      const mockAppointment = new Appointment(
        "appointment-123",
        "0001",
        10,
        "PE",
        "pending",
        "2024-01-01T00:00:00.000Z",
        "2024-01-01T00:00:00.000Z"
      );

      mockExecute.mockResolvedValue(mockAppointment);

      const event: APIGatewayProxyEvent = {
        httpMethod: "POST",
        path: "/appointments",
        body: JSON.stringify({
          insuredId: "0001",
          scheduleId: 10,
          countryISO: "PE",
        }),
      } as APIGatewayProxyEvent;

      // Act
      const result = await main(event);

      // Assert
      expect(result).toBeDefined();
      expect(result?.statusCode).toBe(201);

      const body = JSON.parse(result?.body || "{}");
      expect(body).toHaveProperty("message");
      expect(body).toHaveProperty("appointmentId");
      expect(body.appointmentId).toBe("appointment-123");
      expect(body.status).toBe("pending");
    });

    it("should return 400 if body is invalid", async () => {
      // Arrange
      const event: APIGatewayProxyEvent = {
        httpMethod: "POST",
        path: "/appointments",
        body: JSON.stringify({
          insuredId: "", // invalid: empty string
          scheduleId: -1, // invalid: negative number
          countryISO: "MX", // invalid: not PE or CL
        }),
      } as APIGatewayProxyEvent;

      // Act
      const result = await main(event);

      // Assert
      expect(result).toBeDefined();
      expect(result?.statusCode).toBe(400);

      const body = JSON.parse(result?.body || "{}");
      expect(body).toHaveProperty("message");
      expect(body.message).toContain("Error de validación");
    });
  });
});

