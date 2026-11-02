import 'dotenv/config';
import cron from 'node-cron';
import { createCatalog } from '@raahi/planner';
import { createApp, type AppState } from './app';
import { openRepo } from './repo';

const repo = await openRepo();
const state: AppState = {
  catalog: createCatalog(await repo.loadDataset()),
  weekly: await repo.weeklyCounts(10),
  refreshedAt: Date.now(),
};

// Freshness jobs. Trend counts every hour; full data reload every Monday at 03:00.
cron.schedule('5 * * * *', async () => {
  state.weekly = await repo.weeklyCounts(10);
  state.refreshedAt = Date.now();
});
cron.schedule('0 3 * * 1', async () => {
  state.catalog = createCatalog(await repo.loadDataset());
  console.log('↻ Weekly data refresh done');
});

const port = Number(process.env.PORT ?? 4000);
createApp(repo, state).listen(port, () => {
  const d = state.catalog.data;
  console.log(`✓ Raahi API on http://localhost:${port} — ${d.destinations.length} destinations, ${d.places.length} places (${repo.kind} storage)`);
});
