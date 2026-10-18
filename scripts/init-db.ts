import { getDb, closeDb } from "../src/db/client.js";
import { logger } from "../src/utils/logger.js";

try {
  getDb();
  logger.info("Database initialized successfully");
} catch (err) {
  logger.error("Failed to initialize database", err);
  process.exit(1);
} finally {
  closeDb();
}
