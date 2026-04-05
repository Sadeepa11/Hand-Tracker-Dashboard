import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[REGISTER] Request body:", body);
    const { username, password } = body;

    if (!username || !password) {
      console.warn("[REGISTER] Missing fields");
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    console.log("[REGISTER] Checking existing user for:", username);
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.warn("[REGISTER] User already exists:", username);
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    console.log("[REGISTER] Hashing password...");
    const passwordHash = await bcrypt.hash(password, 10);

    console.log("[REGISTER] Creating user in DB...");
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
      },
    });

    console.log("[REGISTER] Success. User ID:", user.id);
    return NextResponse.json({ message: "User registered successfully", userId: user.id }, { status: 201 });
  } catch (error: any) {
    console.error("[REGISTER] CRITICAL ERROR:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
