# ERICA feed sync

The app collects two public feeds: ERICA academic notices and the official ERICA blog RSS. It stores title, short summary, source, category, published date, and original URL. Posts already saved are retained when they disappear from the RSS window; updated posts are upserted by ID. This is not a full-site archive or an Instagram/HY-in scraper.

## Local development

- Without `FEED_DATABASE_URL`, the app saves an index at `data/erica-feed-index.json` (Git-ignored). The feed refreshes when requested after its 10-minute cache expires.
- `npm run test:feed` runs parser and accumulation tests.
- `npm run check` checks TypeScript.
- The local index is not shared with a deployed app. Back it up separately if needed.

## Shared PostgreSQL and GitHub Actions

1. Provision a PostgreSQL database (for example, Supabase). Use a server-side connection string with permission to create tables. Never put the password in frontend environment variables or commit it.
2. Set `FEED_DATABASE_URL` in the app's server environment. The feed tables are created on first access and the app reads accumulated rows from this database.
3. Publish this repository to the intended GitHub account and merge the feed changes into the default branch. Scheduled workflows only run from the default branch.
4. Add the same connection string as a GitHub Actions repository secret named `FEED_DATABASE_URL`.
5. Run the `Sync ERICA feed` workflow manually once and inspect its logs. The schedule is four times per day at 09:17, 13:17, 18:17, and 22:17 KST. A missing DB secret or failed source causes a failed run, not a silent success. Enable GitHub Actions failure notifications for the repository.

The scheduled command is `npm run feed:sync`. It requires `FEED_DATABASE_URL` and exits nonzero if either source fails. It stores any source that succeeded before reporting partial failure, so the next run can recover. The app can still show a local index if its configured feed DB is unavailable, with an on-screen warning.

## Data-quality boundary

The academic RSS may include Seoul-campus posts, so only titles marked ERICA are stored. RSS publication dates are used for sorting, not the feed's own update time. Instagram and HY-in are outbound links; no automatic text collection is claimed. Check source permissions before adding other sites. For critical dates and eligibility, follow the original notice.
