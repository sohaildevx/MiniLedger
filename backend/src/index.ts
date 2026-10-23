import os from 'os';
import { createApp } from './app';
import { config } from './config';
import { pool } from './db';

/** Local IPv4 addresses - used to print the URL a real phone should call. */
function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

const app = createApp();

// 0.0.0.0, not localhost: binding to localhost would make the API unreachable
// from a phone or an Android emulator.
app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MiniLedger API listening on http://0.0.0.0:${config.PORT}`);
  console.log(`   Local:      http://localhost:${config.PORT}/health`);

  for (const ip of lanAddresses()) {
    console.log(`   On your phone (same Wi-Fi): http://${ip}:${config.PORT}`);
  }
  console.log('');
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, closing the database pool...`);
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
