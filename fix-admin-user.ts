import { auth } from "./src/lib/auth/auth-instance";
import { pgDb as db } from "./src/lib/db/pg/db.pg";
import { UserTable, AccountTable } from "./src/lib/db/pg/schema.pg";
import { sql } from "drizzle-orm";

async function fixAdminUser() {
  try {
    console.log("Fixing admin user...");

    // Delete existing account entry if it exists
    const existingUser = await db
      .select()
      .from(UserTable)
      .where(sql`email = 'admin@example.com'`)
      .limit(1);

    if (existingUser.length > 0) {
      const userId = existingUser[0].id;

      // Delete existing account
      await db.delete(AccountTable).where(sql`user_id = ${userId}`);
      console.log("Deleted existing account entry");

      // Delete user
      await db.delete(UserTable).where(sql`id = ${userId}`);
      console.log("Deleted existing user");
    }

    // Create new user with Better Auth API
    const result = await auth.api.signUpEmail({
      body: {
        email: "admin@example.com",
        password: "admin123",
        name: "Admin User",
      },
      headers: new Headers({
        "content-type": "application/json",
      }),
    });

    if (!result.user) {
      throw new Error("User creation failed");
    }

    console.log("Created user:", result.user.id);

    // Update to super_admin role
    await db
      .update(UserTable)
      .set({
        role: "super_admin",
        accountType: "normal",
        plan: "enterprise",
        isOwner: true,
      })
      .where(sql`id = ${result.user.id}`);

    console.log("✅ Admin user fixed successfully!");
    console.log("Email: admin@example.com");
    console.log("Password: admin123");

    process.exit(0);
  } catch (error) {
    console.error("Error fixing admin user:", error);
    process.exit(1);
  }
}

fixAdminUser();
