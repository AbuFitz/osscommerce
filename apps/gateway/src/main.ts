import { loadConfig } from './config.ts';
import { createRuntime } from './runtime.ts';

async function main() {
  const config = loadConfig(process.env);
  const { pool, server } = await createRuntime(config);
  server.requestTimeout = 15000; server.headersTimeout = 17000; server.keepAliveTimeout = 5000;
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  server.listen(config.PORT, '0.0.0.0', () => console.log(`gateway listening on ${config.PORT} (${config.APP_ENV})`));

  let closing = false;
  async function close(signal: string) {
    if (closing) return; closing = true; console.log(`gateway stopping (${signal})`);
    const timer = setTimeout(() => process.exit(1), 10000); timer.unref();
    server.close(async () => { await pool.end(); clearTimeout(timer); process.exit(0); });
  }
  for (const signal of ['SIGTERM','SIGINT'] as const) process.on(signal, () => void close(signal));
}

main().catch(() => { console.error('gateway failed to start: check its configuration and control-plane connection'); process.exit(1); });
