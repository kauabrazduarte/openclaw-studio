import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  applyStudioSettingsPatch,
  loadStudioSettings,
} from "@/lib/studio/settings.server";
import { type StudioSettingsPatch } from "@/lib/studio/settings";

export const runtime = "nodejs";

const isPatch = (value: unknown): value is StudioSettingsPatch =>
  Boolean(value && typeof value === "object");

export async function GET() {
  try {
    const settings = loadStudioSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load studio settings.";
    logger.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isPatch(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const settings = applyStudioSettingsPatch(body);
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save studio settings.";
    logger.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
