import { getPrismaClClient } from "../../src/infrastructure/rds/prisma/clientCl.js";

const main = async (): Promise<void> => {
  const prisma = getPrismaClClient();

  try {
    // Verificar conexión usando $connect() que no requiere prepared statements
    await prisma.$connect();
    console.log("CL DB OK");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    // @ts-expect-error - process is available at runtime in Node.js
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();



