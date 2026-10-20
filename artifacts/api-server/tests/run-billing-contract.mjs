// No inherited database/provider credentials: all state lives in this temporary cluster.
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const suite = process.argv[2] ?? "billing";
if (!["billing", "recovery"].includes(suite)) throw new Error("Unknown isolated contract suite.");
const scratch = await mkdtemp(path.join(tmpdir(), "cd-billing-"));
const socket = path.join(scratch, "socket");
const env = {
  PATH: process.env.PATH, HOME: scratch, LANG: "C.UTF-8", TZ: "UTC",
  NODE_ENV: "test", BILLING_CONTRACT_TEST: "isolated",
  DATABASE_URL: `postgresql://runner@localhost/billing_contract?host=${encodeURIComponent(socket)}`,
  WHOP_COMPANY_ID: "biz_contract", WHOP_PRODUCT_ID: "prod_contract", WHOP_PLAN_ID: "plan_base",
  BILLING_APP_ORIGIN: "https://billing.example.test",
  SESSION_SECRET: "disposable-test-encryption-key",
  REPLIT_CONNECTORS_HOSTNAME: "connector.example.test", REPL_IDENTITY: "fake-test-identity",
};
function run(command, args, options = {}, cleanup = false) {
  return new Promise((resolve, reject) => {
    if (interrupted && !cleanup) { reject(new Error("Billing contracts interrupted.")); return; }
    const child = spawn(command, args, { cwd, env, stdio: "inherit", ...options });
    activeChild = child;
    child.once("error", reject);
    child.once("exit", code => {
      if (activeChild === child) activeChild = undefined;
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`));
    });
  });
}
let started = false;
let activeChild;
let interrupted = false;
const stopChild = () => { interrupted = true; activeChild?.kill("SIGTERM"); };
process.once("SIGINT", stopChild);
process.once("SIGTERM", stopChild);
try {
  await mkdir(socket);
  await run("initdb", ["-D", path.join(scratch, "pg"), "-U", "runner", "-A", "trust", "--no-locale", "--encoding=UTF8"], { stdio: "ignore" });
  // Unix socket only. Never attach to the workspace database or open a TCP listener.
  await run("pg_ctl", ["-D", path.join(scratch, "pg"), "-l", path.join(scratch, "postgres.log"),
    "-o", `-F -k ${socket} -c listen_addresses=''`, "-w", "start"], { stdio: "ignore" });
  started = true;
  await run("createdb", ["-h", socket, "-U", "runner", "billing_contract"]);
  await run("pnpm", ["--filter", "@workspace/db", "exec", "drizzle-kit", "generate",
    "--dialect=postgresql", "--schema=./src/schema/index.ts", `--out=${scratch}/migrations`]);
  const migrations = (await readdir(path.join(scratch, "migrations"))).filter(name => name.endsWith(".sql"));
  if (migrations.length !== 1) throw new Error("Expected a fresh schema migration.");
  env.BILLING_CONTRACT_SCHEMA = path.join(scratch, "migrations", migrations[0]);
  const outfile = path.join(scratch, "billing-contract.cjs");
  await build({
    absWorkingDir: cwd, entryPoints: [suite === "recovery" ? "tests/account-recovery.integration.ts" : "tests/billing-contract.integration.ts"],
    bundle: true, platform: "node", format: "cjs", external: ["pg-native"], outfile,
  });
  await run(process.execPath, [outfile]);
} finally {
  try {
    if (started) await run("pg_ctl", ["-D", path.join(scratch, "pg"), "-m", "immediate", "-w", "stop"], { stdio: "ignore" }, true);
  } finally {
    await rm(scratch, { recursive: true, force: true });
    process.removeListener("SIGINT", stopChild);
    process.removeListener("SIGTERM", stopChild);
  }
}
