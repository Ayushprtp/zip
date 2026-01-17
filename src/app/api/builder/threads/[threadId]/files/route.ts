import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { pgDb } from "@/lib/db/pg/db.pg";
import { builderThreads, builderFiles } from "@/db/schema/builder";
import { eq, and } from "drizzle-orm";

// POST /api/builder/threads/[threadId]/files - Save/update file
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = params;
    const body = await request.json();
    const { filePath, fileContent } = body;

    if (!filePath || fileContent === undefined) {
      return NextResponse.json(
        { error: "filePath and fileContent are required" },
        { status: 400 },
      );
    }

    // Verify thread ownership
    const [thread] = await pgDb
      .select()
      .from(builderThreads)
      .where(
        and(
          eq(builderThreads.id, threadId),
          eq(builderThreads.userId, session.user.id),
        ),
      );

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Upsert file (insert or update if exists)
    const [file] = await pgDb
      .insert(builderFiles)
      .values({
        threadId,
        filePath,
        fileContent,
      })
      .onConflictDoUpdate({
        target: [builderFiles.threadId, builderFiles.filePath],
        set: {
          fileContent,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Update thread's updatedAt
    await pgDb
      .update(builderThreads)
      .set({ updatedAt: new Date() })
      .where(eq(builderThreads.id, threadId));

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}

// DELETE /api/builder/threads/[threadId]/files - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");

    if (!filePath) {
      return NextResponse.json(
        { error: "filePath is required" },
        { status: 400 },
      );
    }

    // Verify thread ownership
    const [thread] = await pgDb
      .select()
      .from(builderThreads)
      .where(
        and(
          eq(builderThreads.id, threadId),
          eq(builderThreads.userId, session.user.id),
        ),
      );

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await pgDb
      .delete(builderFiles)
      .where(
        and(
          eq(builderFiles.threadId, threadId),
          eq(builderFiles.filePath, filePath),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
