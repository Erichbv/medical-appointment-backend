import { GetAppointmentsByInsuredUseCase } from "../GetAppointmentsByInsuredUseCase.js";
import type { AppointmentDynamoRepository } from "../../../infrastructure/dynamodb/AppointmentDynamoRepository.js";
import { Appointment } from "../../../domain/entities/Appointment.js";

describe("GetAppointmentsByInsuredUseCase", () => {
  let useCase: GetAppointmentsByInsuredUseCase;
  let mockAppointmentRepo: Partial<AppointmentDynamoRepository> & {
    findByInsuredId: jest.Mock<Promise<Appointment[]>, [insuredId: string]>;
  };

  beforeEach(() => {
    mockAppointmentRepo = {
      findByInsuredId: jest.fn<Promise<Appointment[]>, [insuredId: string]>(),
    };

    useCase = new GetAppointmentsByInsuredUseCase(
      mockAppointmentRepo as unknown as AppointmentDynamoRepository
    );
  });

  describe("execute", () => {
    it("debe retornar una lista de appointments obtenidos del repo", async () => {
      // Arrange
      const insuredId = "ABC";
      const mockAppointments: Appointment[] = [
        new Appointment(
          "appointment-1",
          insuredId,
          123,
          "PE",
          "pending",
          "2024-01-01T00:00:00.000Z",
          "2024-01-01T00:00:00.000Z"
        ),
        new Appointment(
          "appointment-2",
          insuredId,
          456,
          "CL",
          "completed",
          "2024-01-02T00:00:00.000Z",
          "2024-01-02T00:00:00.000Z"
        ),
      ];

      mockAppointmentRepo.findByInsuredId.mockResolvedValue(mockAppointments);

      // Act
      const result = await useCase.execute(insuredId);

      // Assert
      expect(mockAppointmentRepo.findByInsuredId).toHaveBeenCalledTimes(1);
      expect(mockAppointmentRepo.findByInsuredId).toHaveBeenCalledWith(insuredId);
      expect(result).toEqual(mockAppointments);
    });
  });
});

