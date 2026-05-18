import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[api] Listening on port ${config.port} (${config.nodeEnv})`);
});
