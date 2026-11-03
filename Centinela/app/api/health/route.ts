import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Chequeo de vida para la demo y el RUNBOOK: público, así que no expone nada más que "ok".
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: "ok" })
  } catch (error) {
    console.error("[health] la base de datos no responde:", error)
    return NextResponse.json({ ok: false, db: "caida" }, { status: 503 })
  }
}
