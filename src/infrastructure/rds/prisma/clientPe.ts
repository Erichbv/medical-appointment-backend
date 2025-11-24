import { PrismaClient as PrismaClientPe } from "@prisma/client-pe";

let prismaPe: PrismaClientPe | null = null;

export const getPrismaPeClient = (): PrismaClientPe => {
  if (!prismaPe) {
    const globalPrisma = (globalThis as any).prismaPe as PrismaClientPe | undefined;
    
    if (globalPrisma) {
      prismaPe = globalPrisma;
    } else {
      prismaPe = new PrismaClientPe();
      (globalThis as any).prismaPe = prismaPe;
    }
  }

  return prismaPe;
};

