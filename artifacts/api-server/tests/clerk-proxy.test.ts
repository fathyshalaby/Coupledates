import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import test from "node:test";
import type { Request, Response, NextFunction } from "express";
import {
  CLERK_PROXY_PATH,
  createClerkProxyMiddleware,
} from "../src/middlewares/clerkProxyMiddleware";

async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("Clerk proxy preserves the API path, forwarded identity headers, and response length", async () => {
  let upstreamRequest:
    | { url: string | undefined; headers: Record<string, string | string[] | undefined> }
    | undefined;

  const upstream = createServer((req, res) => {
    upstreamRequest = { url: req.url, headers: req.headers };
    res.writeHead(200, { "content-type": "application/json" });
    res.write('{"status":');
    setImmediate(() => res.end('"ok"}'));
  });
  const upstreamPort = await listen(upstream);

  const proxyMiddleware = createClerkProxyMiddleware(
    `http://127.0.0.1:${upstreamPort}`,
    "sk_test_proxy_secret",
  );
  const app = createServer((incoming, outgoing) => {
    const originalUrl = incoming.url ?? "/";
    const request = Object.assign(incoming, {
      originalUrl,
      baseUrl: CLERK_PROXY_PATH,
      url: originalUrl.slice(CLERK_PROXY_PATH.length) || "/",
    });
    request.headers["x-forwarded-host"] = "couple.example, internal";
    request.headers["x-forwarded-proto"] = "https";
    request.headers["x-forwarded-for"] = "203.0.113.7, 10.0.0.2";

    proxyMiddleware(
      request as unknown as Request,
      outgoing as unknown as Response,
      (() => undefined) as NextFunction,
    );
  });

  try {
    const appPort = await listen(app);
    const response = await fetch(
      `http://127.0.0.1:${appPort}${CLERK_PROXY_PATH}/v1/client?locale=en`,
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, '{"status":"ok"}');
    assert.equal(response.headers.get("content-length"), String(Buffer.byteLength(body)));
    assert.equal(response.headers.get("transfer-encoding"), null);
    assert.equal(upstreamRequest?.url, "/v1/client?locale=en");
    assert.equal(upstreamRequest?.headers["clerk-secret-key"], "sk_test_proxy_secret");
    assert.equal(
      upstreamRequest?.headers["clerk-proxy-url"],
      `https://couple.example${CLERK_PROXY_PATH}`,
    );
    assert.equal(upstreamRequest?.headers["x-forwarded-for"], "203.0.113.7");
  } finally {
    await Promise.all([close(app), close(upstream)]);
  }
});
