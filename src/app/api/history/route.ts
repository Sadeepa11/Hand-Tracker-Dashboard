import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "sci-fi-secret-key-12345";

async function getAuthenticatedUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const history = await prisma.calculation.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { expression, result } = await req.json();
    if (!expression || !result) {
      return NextResponse.json({ error: "Missing calculation data" }, { status: 400 });
    }

    const calculation = await prisma.calculation.create({
      data: {
        expression,
        result: String(result),
        userId: user.userId,
      },
    });

    return NextResponse.json(calculation, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save calculation" }, { status: 500 });
  }
}
