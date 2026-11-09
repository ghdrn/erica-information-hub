import "dotenv/config";
import { syncEricaFeed } from "../server/erica-feed-service";
import { closeFeedStore } from "../server/erica-feed-store";

try {
  const feed = await syncEricaFeed(true);
  console.log(`ERICA feed synced: ${feed.items.length} stored items at ${feed.fetchedAt}`);
} catch (error) {
  console.error("ERICA feed sync failed:", error);
  process.exitCode = 1;
} finally {
  await closeFeedStore();
}
