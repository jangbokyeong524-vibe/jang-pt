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
  component.includes('className="schedule-calendar"'),
  "schedule detail screens should use a monthly date calendar"
);

assert(
  component.includes('className="schedule-time-list"'),
  "schedule detail screens should show selected-day time slots as a list"
);

for (const className of ["schedule-slot-time", "schedule-slot-copy", "schedule-slot-meta"]) {
  assert(component.includes(`className="${className}"`), `schedule slot cards should include compact row structure: ${className}`);
}

assert(
  /\.schedule-slot-card\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/s.test(css),
  "schedule slot cards should use a compact time/title/meta row"
);

assert(
  /\.schedule-slot-card\s*\{[^}]*min-height:\s*5[2-9]px/s.test(css),
  "schedule slot cards should keep a compact mobile row height"
);

assert(
  !/\.schedule-slot-card\s*\{[^}]*padding:\s*1[24]px/s.test(css),
  "schedule slot cards must not keep large mobile padding"
);

assert(
  !/@media[^{]*\(min-width:\s*721px\)[\s\S]*?\.schedule-slot-card\s*\{[^}]*padding:\s*14px/s.test(css),
  "desktop schedule slot cards must not expand back to large padding"
);

assert(
  component.includes("MonthlySchedulePicker"),
  "admin and member schedule screens should share the monthly calendar/time-list picker"
);

assert(
  component.includes("getScheduleDaySummary") && component.includes("scheduleDaySummary"),
  "schedule calendar should use role-specific day summaries"
);

assert(
  component.includes('variant="member"') && component.includes('variant="admin"'),
  "admin and member schedule calendars should declare their role variant"
);

for (const className of ["schedule-day-label", "member-slot-primary"]) {
  assert(component.includes(`className="${className}"`), `member schedule should include calendar-first/member-only structure: ${className}`);
}

assert(
  /className=\{`member-slot-row/.test(component),
  "member schedule should render member-slot-row rows"
);

assert(
  component.includes("visibleMemberSlots") && component.includes("memberReservationForSlot"),
  "member booking should hide unavailable slots and only render member-owned reservations"
);

assert(
  component.includes("requestCancel={requestCancel}") && /function MemberBookingView[\s\S]*requestCancel: \(reservationId: string\) => void/.test(component),
  "member booking rows should expose cancel action for own confirmed reservations"
);

const memberBookingView = component.slice(component.indexOf("function MemberBookingView"), component.indexOf("function MemberHistoryView"));
assert(
  !memberBookingView.includes("memberName("),
  "member booking screen must not render other member names"
);

assert(
  !component.includes('className="week-matrix"') && !component.includes('className="week-time-row"'),
  "schedule detail screens must not use the old seven-day time matrix"
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
  component.includes('label="일정"'),
  "admin bottom tabs should label the schedule tab as 일정"
);

for (const label of ["월", "주", "일"]) {
  assert(component.includes(`label: "${label}"`), `schedule view switch should include ${label}`);
}

for (const label of ["전체", "PT", "오전반", "초등부", "일반부"]) {
  assert(component.includes(`label: "${label}"`), `schedule type filter should include ${label}`);
}

assert(
  component.includes('const ptVisibleScheduleTypes: ScheduleTypeFilter[] = ["all", "pt"];'),
  "only 전체/PT filters should render PT reservation data in this shell"
);

assert(
  component.includes("아직 등록된 수업 일정이 없습니다.") &&
    component.includes("설정에서 프로그램 운영 시간을 추가하면 여기에 표시됩니다."),
  "general class filters should render the class schedule empty state"
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

assert(
  /\.admin-bottom-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s.test(css),
  "admin bottom tabs should use a four-column grid for even icon alignment"
);

assert(
  !/\.tab\s*\{[^}]*flex:\s*0\s+0\s+70px/s.test(css) && !/\.tab\s*\{[^}]*min-width:\s*70px/s.test(css),
  "bottom tab buttons must not keep the old fixed-width flex sizing"
);

for (const label of ["PT 상품", "운영 정책", "안내 문구", "CSV 내보내기"]) {
  assert(component.includes(label), `settings root menu should include ${label}`);
}

for (const label of ["예약", "취소", "연장", "재등록"]) {
  assert(component.includes(`settings-policy-${label}`), `settings policy submenu should include ${label}`);
}

assert(
  component.includes("type SettingsSection") && component.includes("type PolicySection"),
  "settings screen should use explicit section state for two- and three-depth navigation"
);

if (failures.length > 0) {
  console.error("Layout layering check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Layout layering check passed.");
