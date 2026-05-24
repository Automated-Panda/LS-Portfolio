// Run: tsx lib/organizer/__samples__/run.ts
// Eyeball verification of the planner against the fixtures in sample-plans.ts.

import { generatePlan } from "../planner";
import { SAMPLES } from "./sample-plans";

let passCount = 0;
let failCount = 0;

for (const s of SAMPLES) {
  const result = generatePlan({
    intent: s.intent,
    portfolio: { vehicles: s.vehicles, properties: s.properties },
    manufacturerIdByDisplay: new Map([["Mock", "mock-mfr"]]),
  });

  const pass =
    result.ok === s.expect.ok &&
    (!s.expect.ok ||
      (result.ok &&
        (s.expect.carsMoved === undefined || result.summary.cars_moved === s.expect.carsMoved) &&
        (s.expect.carsUnassigned === undefined || result.summary.cars_unassigned === s.expect.carsUnassigned) &&
        (s.expect.totalSteps === undefined || result.summary.total_steps === s.expect.totalSteps)));

  if (pass) {
    passCount++;
    console.log(`✓ ${s.name} — ${s.description}`);
  } else {
    failCount++;
    console.log(`✗ ${s.name} — ${s.description}`);
    console.log(`  expected: ${JSON.stringify(s.expect)}`);
    if (result.ok) {
      console.log(`  actual:   ${JSON.stringify({ ok: true, summary: result.summary })}`);
      console.log(`  steps:`);
      for (const st of result.steps) {
        console.log(`    [${st.index}] ${st.type} ${st.vehicle_label}: ${st.from.label} → ${st.to.label} (${st.reason})`);
      }
    } else {
      console.log(`  actual:   ${JSON.stringify({ ok: false, failure: result.failure })}`);
    }
  }
}

console.log(`\n${passCount} passed, ${failCount} failed`);
process.exit(failCount === 0 ? 0 : 1);
