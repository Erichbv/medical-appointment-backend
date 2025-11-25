import { CreateAppointmentUseCase } from "../CreateAppointmentUseCase.js";
import type { AppointmentDynamoRepository } from "../../../infrastructure/dynamodb/AppointmentDynamoRepository.js";
import type { AppointmentRequestedPublisher } from "../../../infrastructure/messaging/sns/AppointmentRequestedPublisher.js";
import type { CreateAppointmentRequestDTO } from "../../../interfaces/http/dto/CreateAppointmentRequestDTO.js";
import { Appointment } from "../../../domain/entities/Appointment.js";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "mock-uuid-123"),
}));

describe("CreateAppointmentUseCase", () => {
  let useCase: CreateAppointmentUseCase;
  let mockAppointmentRepo: Partial<AppointmentDynamoRepository> & {
    createPending: jest.Mock<Promise<void>, [appointment: Appointment]>;
  };
  let mockPublisher: Partial<AppointmentRequestedPublisher> & {
    publish: jest.Mock<Promise<void>, [appointment: Appointment]>;
  };

  beforeEach(() => {
    mockAppointmentRepo = {
      createPending: jest.fn<Promise<void>, [appointment: Appointment]>(),
    };

    mockPublisher = {
      publish: jest.fn<Promise<void>, [appointment: Appointment]>(),
    };

    useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as unknown as AppointmentDynamoRepository,
      mockPublisher as unknown as AppointmentRequestedPublisher
    );
  });

  describe("execute", () => {
    it("should create an appointment in pending status and publish SNS event", async () => {
      // Arrange
      const request: CreateAppointmentRequestDTO = {
        insuredId: "insured-123",
        scheduleId: 456,
        countryISO: "PE",
      };

      mockAppointmentRepo.createPending.mockResolvedValue(undefined);
      mockPublisher.publish.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockAppointmentRepo.createPending).toHaveBeenCalledTimes(1);
      expect(mockAppointmentRepo.createPending).toHaveBeenCalledWith(
        expect.any(Appointment)
      );

      const appointmentArg = mockAppointmentRepo.createPending.mock
        .calls[0]?.[0] as Appointment;
      expect(appointmentArg).toBeDefined();
      expect(appointmentArg.insuredId).toBe(request.insuredId);
      expect(appointmentArg.scheduleId).toBe(request.scheduleId);
      expect(appointmentArg.countryISO).toBe(request.countryISO);
      expect(appointmentArg.status).toBe("pending");

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.any(Appointment)
      );

      expect(result).toBeInstanceOf(Appointment);
      expect(result.appointmentId).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.insuredId).toBe(request.insuredId);
      expect(result.scheduleId).toBe(request.scheduleId);
      expect(result.countryISO).toBe(request.countryISO);
    });
  });
});

