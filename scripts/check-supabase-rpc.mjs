import { existsSync, readFileSync } from "node:fs";

const schema = readFileSync("docs/supabase-schema.sql", "utf8");
const dataModel = readFileSync("docs/DATA_MODEL.md", "utf8");
const security = readFileSync("docs/SECURITY.md", "utf8");
const testPlan = readFileSync("docs/TEST_PLAN.md", "utf8");
const adapter = readFileSync("lib/reservation-actions.ts", "utf8");
const passAdapter = readFileSync("lib/pass-actions.ts", "utf8");
const paymentAdapter = existsSync("lib/payment-actions.ts") ? readFileSync("lib/payment-actions.ts", "utf8") : "";

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const rpcNames = [
  "request_reservation",
  "approve_reservation",
  "reject_reservation",
  "request_reservation_cancel",
  "resolve_late_cancel",
  "complete_session"
];

for (const rpcName of rpcNames) {
  const functionPattern = new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`, "i");
  assert(functionPattern.test(schema), `${rpcName} RPC should be defined in Supabase schema`);
  assert(adapter.includes(`"${rpcName}"`), `${rpcName} RPC should be represented in the reservation action adapter`);
}

for (const rpcName of rpcNames) {
  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${rpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );

  assert(bodyMatch?.[0].includes("security definer"), `${rpcName} should be security definer`);
}

for (const adminRpcName of ["approve_reservation", "reject_reservation", "resolve_late_cancel", "complete_session"]) {
  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${adminRpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );

  assert(bodyMatch?.[0].includes("public.is_admin()"), `${adminRpcName} should guard admin access`);
}

for (const memberRpcName of ["request_reservation", "request_reservation_cancel"]) {
  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${memberRpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );

  assert(bodyMatch?.[0].includes("public.approved_member_id()"), `${memberRpcName} should guard approved member access`);
}

const passRpcNames = ["create_pt_pass"];

for (const rpcName of passRpcNames) {
  const functionPattern = new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`, "i");
  assert(functionPattern.test(schema), `${rpcName} RPC should be defined in Supabase schema`);
  assert(passAdapter.includes(`"${rpcName}"`), `${rpcName} RPC should be represented in the pass action adapter`);
}

for (const adminRpcName of passRpcNames) {
  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${adminRpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );

  assert(bodyMatch?.[0].includes("security definer"), `${adminRpcName} should be security definer`);
  assert(bodyMatch?.[0].includes("public.is_admin()"), `${adminRpcName} should guard admin access`);
  assert(bodyMatch?.[0].includes("public.pt_passes"), `${adminRpcName} should insert a PT pass`);
  assert(bodyMatch?.[0].includes("public.payments"), `${adminRpcName} should create the initial payment row`);
  assert(bodyMatch?.[0].includes("public.pass_events"), `${adminRpcName} should create the initial pass event`);
}

assert(
  schema.includes("grant execute on function public.create_pt_pass"),
  "create_pt_pass should be executable through explicit grants"
);

const paymentRpcNames = ["change_payment_status"];

for (const rpcName of paymentRpcNames) {
  const functionPattern = new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`, "i");
  assert(functionPattern.test(schema), `${rpcName} RPC should be defined in Supabase schema`);
  assert(paymentAdapter.includes(`"${rpcName}"`), `${rpcName} RPC should be represented in the payment action adapter`);

  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${rpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );

  assert(bodyMatch?.[0].includes("security definer"), `${rpcName} should be security definer`);
  assert(bodyMatch?.[0].includes("public.is_admin()"), `${rpcName} should guard admin access`);
  assert(bodyMatch?.[0].includes("public.payments"), `${rpcName} should update payments`);
  assert(bodyMatch?.[0].includes("public.pt_passes"), `${rpcName} should update pt_passes`);
  assert(bodyMatch?.[0].includes("public.payment_events"), `${rpcName} should insert payment_events`);
  assert(bodyMatch?.[0].includes("return target_payment.id"), `${rpcName} should no-op same-status requests by returning the payment id`);
}

assert(
  schema.includes("grant execute on function public.change_payment_status"),
  "change_payment_status should be executable through explicit grants"
);

assert(
  !schema.includes('create policy "members create own reservation requests"'),
  "members must not insert reservations directly; use request_reservation RPC"
);

assert(
  !schema.includes('create policy "members update own cancellation requests"'),
  "members must not update reservations directly; use request_reservation_cancel RPC"
);

assert(
  schema.includes("pass_events_one_completion_per_reservation_idx") &&
    schema.includes("where event_type in ('session_completed', 'late_cancel_deducted')"),
  "pass event unique index should prevent duplicate completion and late-cancel deductions"
);

assert(
  schema.includes("payments_one_payment_per_pass_idx"),
  "payments should enforce one payment row per PT pass"
);

for (const doc of [dataModel, security, testPlan]) {
  for (const rpcName of rpcNames.slice(0, 5)) {
    assert(doc.includes(rpcName), `docs should describe ${rpcName}`);
  }
}

if (failures.length > 0) {
  console.error("Supabase reservation RPC check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Supabase reservation RPC check passed.");
