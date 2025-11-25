import { CompleteAppointmentUseCase } from "../CompleteAppointmentUseCase.js";
import type { AppointmentDynamoRepository } from "../../../infrastructure/dynamodb/AppointmentDynamoRepository.js";

describe("CompleteAppointmentUseCase", () => {
  let useCase: CompleteAppointmentUseCase;
  let mockAppointmentRepo: Partial<AppointmentDynamoRepository> & {
    markCompleted: jest.Mock<Promise<void>, [appointmentId: string, insuredId: string]>;
  };

  beforeEach(() => {
    mockAppointmentRepo = {
      markCompleted: jest.fn<Promise<void>, [appointmentId: string, insuredId: string]>(),
    };

    useCase = new CompleteAppointmentUseCase(
      mockAppointmentRepo as unknown as AppointmentDynamoRepository
    );
  });

  describe("execute", () => {
    it("should mark appointment as completed in the repository", async () => {
      // Arrange
      const appointmentId = "123";
      const insuredId = "999";

      mockAppointmentRepo.markCompleted.mockResolvedValue(undefined);

      // Act
      await useCase.execute(appointmentId, insuredId);

      // Assert
      expect(mockAppointmentRepo.markCompleted).toHaveBeenCalledTimes(1);
      expect(mockAppointmentRepo.markCompleted).toHaveBeenCalledWith(appointmentId, insuredId);
    });
  });
});

