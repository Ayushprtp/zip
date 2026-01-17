import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { pgDb } from "@/lib/db/pg/db.pg";
import {
  builderThreads,
  builderMessages,
  builderFiles,
} from "@/db/schema/builder";
import { eq, and, desc } from "drizzle-orm";

// GET /api/builder/threads/[threadId] - Get thread with messages and files
export async function GET(
  _request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = params;

    // Get thread
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

    // Get messages
    const messages = await pgDb
      .select()
      .from(builderMessages)
      .where(eq(builderMessages.threadId, threadId))
      .orderBy(builderMessages.createdAt);

    // Get files
    const files = await pgDb
      .select()
      .from(builderFiles)
      .where(eq(builderFiles.threadId, threadId))
      .orderBy(desc(builderFiles.updatedAt));

    return NextResponse.json({ thread, messages, files });
  } catch (error) {
    console.error("Error fetching builder thread:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 },
    );
  }
}

// PATCH /api/builder/threads/[threadId] - Update thread
export async function PATCH(
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
    const { title, template } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (template !== undefined) updateData.template = template;

    const [thread] = await pgDb
      .update(builderThreads)
      .set(updateData)
      .where(
        and(
          eq(builderThreads.id, threadId),
          eq(builderThreads.userId, session.user.id),
        ),
      )
      .returning();

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error("Error updating builder thread:", error);
    return NextResponse.json(
      { error: "Failed to update thread" },
      { status: 500 },
    );
  }
}

// DELETE /api/builder/threads/[threadId] - Delete thread
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = params;

    await pgDb
      .delete(builderThreads)
      .where(
        and(
          eq(builderThreads.id, threadId),
          eq(builderThreads.userId, session.user.id),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting builder thread:", error);
    return NextResponse.json(
      { error: "Failed to delete thread" },
      { status: 500 },
    );
  }
}
