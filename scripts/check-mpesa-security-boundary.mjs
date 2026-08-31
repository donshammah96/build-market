import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const findings = [];

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(root, relativePath), "utf8");
  } catch {
    findings.push(`${relativePath}: file is missing`);
    return "";
  }
}

function forbid(relativePath, source, pattern, reason) {
  if (pattern.test(source)) findings.push(`${relativePath}: ${reason}`);
}

const clientPaths = [
  "apps/client/app/api/v1/subscriptions/checkout/route.ts",
  "apps/client/app/api/v1/payments/mpesa/status/route.ts",
  "apps/client/app/api/webhooks/mpesa/stk-callback/route.ts",
  "apps/client/app/api/webhooks/mpesa/b2c-result/route.ts",
  "apps/client/app/api/webhooks/mpesa/b2c-timeout/route.ts",
  "apps/client/app/lib/domains/payments/mpesa-callback.ts",
];
const adminPaths = [
  "apps/admin/src/actions/admin/mpesa.ts",
  "apps/admin/src/lib/domains/mpesa/service.ts",
];
const providerPaths = [
  "packages/mpesa/src/client.ts",
  "packages/mpesa/src/security.ts",
  "packages/mpesa/src/schemas.ts",
];

for (const relativePath of [...clientPaths, ...adminPaths, ...providerPaths]) {
  const source = await read(relativePath);
  forbid(
    relativePath,
    source,
    /NEXT_PUBLIC_MPESA|MPESA_(?:CONSUMER_SECRET|CONSUMER_KEY|PASSKEY|INITIATOR_PASSWORD|CERTIFICATE_PEM)/,
    "provider secret or public client env reference",
  );
  if (relativePath.startsWith("apps/client/")) {
    forbid(
      relativePath,
      source,
      /new\s+Worker\s*\(/,
      "worker instantiated outside apps/workers",
    );
  }
  if (relativePath.startsWith("packages/mpesa/")) {
    forbid(
      relativePath,
      source,
      /@build\/db|@\/|next\/server/,
      "provider package imports app/database code",
    );
  }
}

for (const relativePath of [
  "apps/client/app/api/webhooks/mpesa/stk-callback/route.ts",
  "apps/client/app/lib/domains/payments/mpesa-callback.ts",
]) {
  const source = await read(relativePath);
  for (const required of [
    "safeParse",
    "createProviderEventKey",
    "hashCallbackPayload",
    "addMpesa",
  ]) {
    if (!source.includes(required))
      findings.push(
        `${relativePath}: callback boundary is missing ${required}`,
      );
  }
}

const adminSource = await read(adminPaths[0]);
const adminServiceSource = await read(adminPaths[1]);
const adminControlSource = `${adminSource}\n${adminServiceSource}`;
for (const required of [
  "safeAction",
  "AdminCapability.PROCESS_PAYOUTS",
  "AdminCapability.RECONCILE_PAYMENTS",
  "CREATE_MPESA_PAYOUT",
  "REQUERY_MPESA_TRANSACTION",
  "SEARCH_MPESA_TRANSACTIONS",
  "recentAuth",
]) {
  if (!adminControlSource.includes(required))
    findings.push(`${adminPaths.join(", ")}: missing ${required} control`);
}

const workerIndexSource = await read("apps/workers/src/index.ts");
for (const required of [
  "mpesa-reconciliation",
  "processMpesaReconciliationJob",
]) {
  if (!workerIndexSource.includes(required))
    findings.push(`apps/workers/src/index.ts: missing reconciliation worker wiring (${required})`);
}

const settlementSource = await read("apps/workers/src/domains/mpesa/settlement.ts");
for (const required of [
  "settlementKey",
  "executeMpesaStkSettlement",
]) {
  if (!settlementSource.includes(required))
    findings.push(`apps/workers/src/domains/mpesa/settlement.ts: missing settlement invariant (${required})`);
}

if (findings.length) {
  console.error(`[mpesa/security-boundary] ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("[mpesa/security-boundary] OK");
}
