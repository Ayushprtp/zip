import { defineConfig } from "drizzle-kit";
import "load-env";

const dialect = "postgresql";

const url = process.env.POSTGRES_URL!;

// Include all schema files
const schema = [
  "./src/lib/db/pg/schema.pg.ts",
  "./src/lib/db/pg/schema-rbac.pg.ts",
  "./src/lib/db/pg/schema-billing.pg.ts",
];

const out = "./src/lib/db/migrations/pg";

export default defineConfig({
  schema,
  out,
  dialect,
  migrations: {},
  dbCredentials: {
    url,
  },
});
