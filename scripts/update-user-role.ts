import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { UserTable } from "../src/lib/db/pg/schema.pg";
import "dotenv/config";

const email = process.argv[2];
const role = process.argv[3] || "super_admin";

if (!email) {
  console.error("Usage: tsx scripts/update-user-role.ts <email> [role]");
  console.error(
    "Example: tsx scripts/update-user-role.ts user@example.com super_admin",
  );
  console.error("Available roles: super_admin, admin, moderator, user");
  process.exit(1);
}

const validRoles = ["super_admin", "admin", "moderator", "user"];
if (!validRoles.includes(role)) {
  console.error(`Invalid role: ${role}`);
  console.error(`Available roles: ${validRoles.join(", ")}`);
  process.exit(1);
}

async function updateUserRole() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("POSTGRES_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString,
  });
  const db = drizzle(pool);

  try {
    console.log(`Looking for user with email: ${email}`);

    // Find the user
    const users = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.email, email))
      .limit(1);

    if (users.length === 0) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`Current role: ${user.role}`);

    // Update the user's role
    const updated = await db
      .update(UserTable)
      .set({
        role: role as "super_admin" | "admin" | "moderator" | "user",
        updatedAt: new Date(),
      })
      .where(eq(UserTable.email, email))
      .returning();

    if (updated.length > 0) {
      console.log(`✅ Successfully updated user role to: ${role}`);
      console.log(`User: ${updated[0].name} (${updated[0].email})`);
      console.log(`New role: ${updated[0].role}`);
    } else {
      console.error("Failed to update user role");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error updating user role:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateUserRole();
