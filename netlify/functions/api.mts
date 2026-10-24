import type { Config } from '@netlify/functions';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
// Import the tsc-compiled output from `nest build` so decorator metadata
// (needed by Nest's dependency injection) is preserved.
import { AppModule, ObserveInstrument } from '../../dist/app.module.js';

let originPromise: Promise<string> | undefined;

// Boot the Nest app once per function instance on a local port, then proxy
// incoming requests to it.
function getOrigin() {
  if (!originPromise) {
    originPromise = (async () => {
      const app = await NestFactory.create(AppModule, {
        instrument: ObserveInstrument,
      });
      await app.listen(0, '127.0.0.1');
      const { port } = app.getHttpServer().address() as AddressInfo;
      return `http://127.0.0.1:${port}`;
    })();
  }
  return originPromise;
}

export default async (req: Request) => {
  const origin = await getOrigin();
  const url = new URL(req.url);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const res = await fetch(origin + url.pathname + url.search, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
  });
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
};

export const config: Config = {
  path: '/*',
};
