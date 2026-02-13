import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { pgDb } from "@/lib/db/pg/db.pg";
import { builderThreads, builderMessages } from "@/db/schema/builder";
import { eq, and } from "drizzle-orm";

// POST /api/builder/threads/[threadId]/messages - Add message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;
    const body = await request.json();
    const { role, content, mentions = [] } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: "Role and content are required" },
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

    const [message] = await pgDb
      .insert(builderMessages)
      .values({
        threadId,
        role,
        content,
        mentions,
      })
      .returning();

    // Update thread's updatedAt
    await pgDb
      .update(builderThreads)
      .set({ updatedAt: new Date() })
      .where(eq(builderThreads.id, threadId));

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 },
    );
  }
}

// DELETE /api/builder/threads/[threadId]/messages - Clear messages
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    const [thread] = await pgDb
      .select()
      .from(builderThreads)
      .where(
        and(
          eq(builderThreads.id, threadId),
          eq(builderThreads.userId, session!.user!.id),
        ),
      );

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await pgDb
      .delete(builderMessages)
      .where(eq(builderMessages.threadId, threadId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing messages:", error);
    return NextResponse.json(
      { error: "Failed to clear messages" },
      { status: 500 },
    );
  }
}
