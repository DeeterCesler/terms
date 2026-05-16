import { createApp } from './app.js';
import { config } from './config.js';
import { startWorker } from './services/processor.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[api] Listening on port ${config.port} (${config.nodeEnv})`);
  startWorker();
});
