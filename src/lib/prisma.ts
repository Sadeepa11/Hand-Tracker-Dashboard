import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const prismaClientSingleton = () => {
  try {
    console.log("[PRISMA] Initializing singleton...");
    // Use absolute path for SQLite database to avoid resolution issues in Next.js
    const dbPath = path.join(process.cwd(), "dev.db");
    console.log("[PRISMA] DB Path:", dbPath);
    const dbUrl = `file:${dbPath}`;
    console.log("[PRISMA] DB URL:", dbUrl);
    
    console.log("[PRISMA] Creating Adapter instance...");
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    
    console.log("[PRISMA] Constructing PrismaClient...");
    return new PrismaClient({ adapter });
  } catch (error) {
    console.error("[PRISMA] FATAL INITIALIZATION ERROR:", error);
    throw error;
  }
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
