import { NextResponse } from "next/server";
import { deleteSubmission, listLeaderboard, normalizeSubmission, saveSubmission } from "@/lib/leaderboard-store";

export async function GET() {
  const entries = await listLeaderboard();
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submission = normalizeSubmission(body);
  if (!submission.publicId) {
    return NextResponse.json({ error: "Public extension profile id is required." }, { status: 403 });
  }

  if (submission.tokensUsed <= 0) {
    return NextResponse.json({ error: "Enter a token count above zero." }, { status: 400 });
  }

  const entry = await saveSubmission(submission);
  const entries = await listLeaderboard();

  return NextResponse.json({ entry, entries }, { status: 201 });
}

export async function DELETE(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const publicId = typeof body.publicId === "string" ? body.publicId : "";
  const removed = await deleteSubmission(publicId);
  const entries = await listLeaderboard();

  return NextResponse.json({ removed, entries });
}
