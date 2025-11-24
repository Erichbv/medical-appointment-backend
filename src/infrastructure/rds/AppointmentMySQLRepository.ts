import type { Appointment } from "../../domain/entities/Appointment.js";

export class AppointmentMySQLRepository {
  constructor(private readonly prisma: any) {}

  async saveToRds(appointment: Appointment): Promise<number> {
    const result = await this.prisma.appointment.create({
      data: {
        insuredId: appointment.insuredId,
        scheduleId: appointment.scheduleId,
        countryISO: appointment.countryISO,
        createdAt: new Date(appointment.createdAt),
        updatedAt: new Date(appointment.updatedAt),
      },
    });

    return result.id;
  }
}

