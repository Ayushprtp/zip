import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { pgDb } from "@/lib/db/pg/db.pg";
import { builderThreads } from "@/db/schema/builder";
import { eq, desc } from "drizzle-orm";

// GET /api/builder/threads - List all builder threads for user
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threads = await pgDb
      .select()
      .from(builderThreads)
      .where(eq(builderThreads.userId, session.user.id))
      .orderBy(desc(builderThreads.updatedAt));

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Error fetching builder threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch threads" },
      { status: 500 },
    );
  }
}

// POST /api/builder/threads - Create new builder thread
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, template } = body;

    if (
      !template ||
      !["react", "nextjs", "vite-react", "vanilla", "static"].includes(template)
    ) {
      return NextResponse.json({ error: "Invalid template" }, { status: 400 });
    }

    const [thread] = await pgDb
      .insert(builderThreads)
      .values({
        userId: session.user.id,
        title: title || "Untitled Project",
        template,
      })
      .returning();

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    console.error("Error creating builder thread:", error);
    return NextResponse.json(
      { error: "Failed to create thread" },
      { status: 500 },
    );
  }
}
