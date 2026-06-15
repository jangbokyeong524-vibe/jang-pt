import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const component = readFileSync("components/pt-management-app.tsx", "utf8");

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

assert(
  !/\.task-panel,\s*\.workspace,\s*\.detail-panel,\s*\.section-band,\s*\.member-app\s*\{/.test(css),
  "workspace/member-app/section-band must not share the global panel surface rule"
);

assert(
  !component.includes("admin-home-workspace"),
  "admin home must use the common flat shell instead of an admin-only flattening class"
);

assert(
  !component.includes('className="section-band week-screen"'),
  "week screens must not combine the generic section-band card with the week layout block"
);

assert(
  /className="app-surface-flat with-bottom-nav"/.test(component),
  "admin shell should use the common flat app surface class"
);

assert(
  /className="member-app app-surface-flat with-bottom-nav"/.test(component),
  "member shell should use the common flat app surface class"
);

assert(
  component.includes('className="week-matrix"'),
  "week detail screens should use a fixed seven-day time matrix"
);

assert(
  component.includes('className="week-time-row"'),
  "week matrix should align slots by shared time rows"
);

assert(
  !component.includes('className="week-grid"') && !component.includes('className="week-grid member-week-grid"'),
  "week detail screens must not use the old horizontally scrolling day-column grid"
);

assert(
  !/\.week-grid\s*\{[^}]*overflow-x:\s*auto/s.test(css),
  "week detail layout must not rely on horizontal overflow"
);

assert(
  !/type AdminTab = [^;]*summary/.test(component),
  "admin tabs must not include the removed CRM summary tab"
);

assert(
  !component.includes('label="CRM"'),
  "admin bottom tabs must not include a CRM tab label"
);

assert(
  !component.includes("SummaryView") && !component.includes("buildCrmSummary"),
  "CRM summary view/helper must be removed in favor of settings CSV export"
);

assert(
  component.includes("buildCsvExport") && component.includes("downloadCsvExport"),
  "settings screen should provide CSV export helpers"
);

assert(
  component.includes("개인정보 포함"),
  "settings CSV export should include an opt-in personal data checkbox"
);

if (failures.length > 0) {
  console.error("Layout layering check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Layout layering check passed.");
