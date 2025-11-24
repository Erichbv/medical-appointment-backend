import { PrismaClient as PrismaClientCl } from "@prisma/client-cl";

let prismaCl: PrismaClientCl | null = null;

export const getPrismaClClient = (): PrismaClientCl => {
  if (!prismaCl) {
    const globalPrisma = (globalThis as any).prismaCl as PrismaClientCl | undefined;
    
    if (globalPrisma) {
      prismaCl = globalPrisma;
    } else {
      prismaCl = new PrismaClientCl();
      (globalThis as any).prismaCl = prismaCl;
    }
  }

  return prismaCl;
};

