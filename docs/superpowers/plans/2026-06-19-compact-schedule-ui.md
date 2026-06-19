# Compact Schedule UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the admin `일정` screen from a control-heavy calendar shell into a compact agenda-first operating view for fast PT reservation handling.

**Architecture:** Keep the existing `ScheduleView`, `WeekSchedule`, and `MonthlySchedulePicker` data path so PT reservation actions remain unchanged. Rebalance only presentation: default to a week/date strip plus selected-day time list, make month calendar secondary, and move future class filters behind a compact filter entry. Enforce the behavior with `npm run check:layout` static contracts before implementation.

**Tech Stack:** Next.js App Router, React client component state, TypeScript, CSS in `app/globals.css`, static contract checks in `scripts/check-layout-layering.mjs`.

---

## Scope

This plan changes only the admin schedule UI density and information hierarchy. It does not add group-class reservation, capacity, attendance, waitlist, recurring timetable generation, or new Supabase reads/writes.

## File Structure

- Modify `components/pt-management-app.tsx`
  - Replace prominent mode/filter controls with a compact schedule toolbar.
  - Add a 7-day date strip for the default week agenda.
  - Keep PT slot rendering and reservation action callbacks unchanged.
- Modify `app/globals.css`
  - Add compact toolbar, date strip, agenda-first, and month-panel layout rules.
  - Remove or neutralize verbose `schedule-mode-summary` spacing.
- Modify `scripts/check-layout-layering.mjs`
  - Add RED contracts that fail when verbose mode guidance, always-visible five-filter rows, or always-primary month calendar return.
- Modify `docs/design.md`
  - Align IA language with compact agenda-first behavior.
- Modify `STATUS.md`
  - Replace `schedule-view-mode-hardening` pointer with compact agenda status after implementation.

## Task 1: Add Static Contract For Compact Agenda UI

**Files:**
- Modify: `scripts/check-layout-layering.mjs`

- [ ] **Step 1: Add failing compact UI assertions**

Add assertions near the existing schedule shell checks:

```js
assert(
  component.includes("scheduleToolbarMode") && component.includes("schedule-compact-toolbar"),
  "admin schedule should use a compact toolbar instead of large mode controls"
);

assert(
  component.includes("schedule-week-strip") && component.includes("schedule-strip-day"),
  "admin schedule should expose a compact 7-day date strip"
);

assert(
  !component.includes("schedule-mode-summary"),
  "admin schedule should not spend vertical space on verbose mode guidance"
);

assert(
  component.includes("primaryScheduleTypeFilters") && component.includes("secondaryScheduleTypeFilters"),
  "schedule type filters should split current PT filters from future class filters"
);

assert(
  /\.schedule-agenda-first\s+\.schedule-week-strip\s*\{[^}]*order:\s*1/s.test(css) &&
    /\.schedule-agenda-first\s+\.schedule-time-list\s*\{[^}]*order:\s*2/s.test(css),
  "agenda-first schedule should keep the week strip above the selected-day time list"
);

assert(
  /\.schedule-week-strip\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/s.test(css),
  "week strip should be a fixed seven-day grid"
);

assert(
  /@media[^{]*\(min-width:\s*1101px\)[\s\S]*?\.schedule-view-month\s*\{[^}]*grid-template-columns:\s*minmax\(320px,\s*1fr\)\s+minmax\(320px,\s*1fr\)/s.test(css),
  "month mode should be the only desktop mode that gives the calendar equal primary space"
);
```

- [ ] **Step 2: Run RED check**

Run:

```bash
npm run check:layout
```

Expected: FAIL with compact schedule contract messages, especially missing `schedule-compact-toolbar`, `schedule-week-strip`, and `scheduleToolbarMode`.

- [ ] **Step 3: Commit only if this task is split**

If implementing task-by-task commits, do not commit this RED-only state. Continue directly to Task 2.

## Task 2: Refactor Admin Schedule Controls Into Compact Toolbar

**Files:**
- Modify: `components/pt-management-app.tsx`

- [ ] **Step 1: Replace verbose mode copy with compact toolbar state**

Remove `scheduleViewModeCopy`. Add these constants near the existing schedule options:

```ts
const scheduleToolbarMode: Record<ScheduleViewMode, string> = {
  month: "월",
  week: "주",
  day: "일"
};

const primaryScheduleTypeFilters = scheduleTypeFilters.filter((option) => option.value === "all" || option.value === "pt");
const secondaryScheduleTypeFilters = scheduleTypeFilters.filter((option) => option.value !== "all" && option.value !== "pt");
```

- [ ] **Step 2: Add compact toolbar UI in `ScheduleView`**

Replace the current `schedule-shell-controls` and `schedule-mode-summary` block with:

```tsx
<div className="schedule-compact-toolbar" aria-label="일정 보기 설정">
  <div>
    <p className="eyebrow">보기</p>
    <strong className="schedule-current-mode">{scheduleToolbarMode[scheduleViewMode]}</strong>
    <select
      aria-label="일정 보기"
      value={scheduleViewMode}
      onChange={(event) => setScheduleViewMode(event.target.value as ScheduleViewMode)}
    >
      {scheduleViewOptions.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
  <div className="schedule-primary-filters" aria-label="주요 일정 타입">
    {primaryScheduleTypeFilters.map((option) => (
      <button
        className={scheduleTypeFilter === option.value ? "small-button active" : "small-button"}
        key={option.value}
        type="button"
        onClick={() => setScheduleTypeFilter(option.value)}
        aria-pressed={scheduleTypeFilter === option.value}
      >
        {option.label}
      </button>
    ))}
    <select
      aria-label="수업 타입 필터"
      value={ptVisibleScheduleTypes.includes(scheduleTypeFilter) ? "" : scheduleTypeFilter}
      onChange={(event) => {
        if (event.target.value) {
          setScheduleTypeFilter(event.target.value as ScheduleTypeFilter);
        }
      }}
    >
      <option value="">수업</option>
      {secondaryScheduleTypeFilters.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
</div>
```

- [ ] **Step 3: Keep existing PT boundary unchanged**

Confirm this condition remains intact:

```ts
const showPtSchedule = ptVisibleScheduleTypes.includes(scheduleTypeFilter);
```

Expected behavior: `전체` and `PT` render existing PT schedule. `오전반`, `초등부`, and `일반부` still render only the class empty state.

## Task 3: Add Agenda-First Date Strip And Month-Only Calendar Emphasis

**Files:**
- Modify: `components/pt-management-app.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Pass display mode into `MonthlySchedulePicker` as compact mode**

Keep `displayMode={scheduleViewMode}` in `WeekSchedule`. Change the picker wrapper class from:

```tsx
<div className={`schedule-picker schedule-view-${displayMode}`}>
```

to:

```tsx
<div className={`schedule-picker schedule-view-${displayMode} ${displayMode === "month" ? "schedule-month-first" : "schedule-agenda-first"}`}>
```

- [ ] **Step 2: Add a week strip inside `MonthlySchedulePicker`**

After `const scheduleDaySummary = ...`, add:

```ts
const selectedWeekDays = useMemo(() => buildWeekStripDays(selectedDay), [selectedDay]);
```

Add this JSX before the calendar section:

```tsx
<section className="schedule-week-strip" aria-label="주간 날짜 선택">
  {selectedWeekDays.map((day) => {
    const daySlots = slotsByDay.get(day) ?? [];
    const daySummary = getScheduleDaySummary(daySlots, reservationsBySlotId, variant);

    return (
      <button
        className={`schedule-strip-day ${daySummary.status} ${selectedDay === day ? "selected" : ""}`}
        type="button"
        key={day}
        onClick={() => {
          setSelectedDay(day);
          setVisibleMonth(monthKey(day));
        }}
        aria-pressed={selectedDay === day}
      >
        <span>{weekdayLabel(day)}</span>
        <strong>{dayDate(day).getUTCDate()}</strong>
        {daySummary.label && <i>{daySummary.label}</i>}
      </button>
    );
  })}
</section>
```

- [ ] **Step 3: Add `buildWeekStripDays` helper**

Add near the other date helpers:

```ts
function buildWeekStripDays(day: string) {
  const selected = dayDate(day);
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() - mondayOffset);

  return Array.from({ length: 7 }, (_item, index) => {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}
```

- [ ] **Step 4: Add compact CSS**

Add CSS near schedule rules:

```css
.schedule-compact-toolbar {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(82px, auto) minmax(0, 1fr);
  gap: 8px;
  align-items: end;
}

.schedule-compact-toolbar select {
  min-height: 40px;
  max-width: 100%;
}

.schedule-primary-filters {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.schedule-primary-filters .small-button.active {
  color: #fff;
  border-color: var(--brand);
  background: var(--brand);
}

.schedule-week-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  order: 1;
}

.schedule-strip-day {
  min-width: 0;
  min-height: 54px;
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 5px 2px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

.schedule-strip-day span,
.schedule-strip-day i {
  overflow: hidden;
  max-width: 100%;
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-strip-day strong {
  font-size: 14px;
  line-height: 1;
}

.schedule-strip-day.selected {
  color: #fff;
  border-color: var(--brand);
  background: var(--brand);
}

.schedule-strip-day.selected span,
.schedule-strip-day.selected i {
  color: rgba(255, 255, 255, 0.82);
}

.schedule-agenda-first .schedule-time-list {
  order: 2;
}

.schedule-agenda-first .schedule-week-strip {
  order: 1;
}

.schedule-agenda-first .schedule-calendar {
  order: 3;
}

.schedule-view-week .schedule-calendar,
.schedule-view-day .schedule-calendar {
  display: none;
}

.schedule-view-month .schedule-calendar {
  display: grid;
}
```

- [ ] **Step 5: Add desktop CSS**

Inside `@media (min-width: 1101px)`, replace mode-specific grid rules with:

```css
.schedule-view-month {
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
}

.schedule-view-week,
.schedule-view-day {
  grid-template-columns: minmax(0, 1fr);
}

.schedule-view-week .schedule-time-list,
.schedule-view-day .schedule-time-list {
  min-height: 420px;
}
```

## Task 4: Update Static Contracts And Docs

**Files:**
- Modify: `scripts/check-layout-layering.mjs`
- Modify: `docs/design.md`
- Modify: `STATUS.md`

- [ ] **Step 1: Run GREEN static check**

Run:

```bash
npm run check:layout
```

Expected: PASS for layout, Supabase reservation RPC, and auth contract checks.

- [ ] **Step 2: Update `docs/design.md`**

Change the admin schedule IA language from always-visible mode/filter controls to compact agenda-first behavior:

```md
- `일정` 상세 화면은 기본적으로 주간 날짜 strip과 선택 날짜 시간 목록을 먼저 보여준다.
- `월` 보기는 월간 달력을 크게 펼치는 탐색 모드이고, `주`와 `일`은 시간 목록 처리에 집중한다.
- `전체`와 `PT`는 바로 선택할 수 있고, `오전반`, `초등부`, `일반부`는 수업 타입 선택 안에 둔다.
```

- [ ] **Step 3: Update `STATUS.md`**

Set:

```md
phase: compact-schedule-ui-plan-executed
```

Add current state bullets:

```md
- Admin `일정` now uses a compact agenda-first layout: the week strip stays directly under the toolbar, selected-day time slots are the main body, and the month calendar appears as the explicit month view.
- Future class filters are compacted behind the class type selector while `전체` and `PT` stay directly available.
```

## Task 5: Final Verification And Commit

**Files:**
- Verify all modified files

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run check:layout
npm run build
git diff --check
```

Expected:
- `npm run check:layout`: exits 0
- `npm run build`: exits 0
- `git diff --check`: exits 0 with no output

- [ ] **Step 2: Inspect diff**

Run:

```bash
git diff --stat
git diff -- components/pt-management-app.tsx app/globals.css scripts/check-layout-layering.mjs docs/design.md STATUS.md
```

Expected: diff is limited to compact schedule UI, contract, design docs, and status.

- [ ] **Step 3: Commit**

Run:

```bash
git add components/pt-management-app.tsx app/globals.css scripts/check-layout-layering.mjs docs/design.md STATUS.md
git commit -m "Compact admin schedule UI"
```

Expected: commit succeeds and `git status --short --branch` shows the branch ahead with no unstaged changes.

## Self-Review

- Spec coverage: Covers compact toolbar, agenda-first hierarchy, week strip, month-only calendar emphasis, future class filter compaction, static contract hardening, docs/status updates, and verification.
- Scope boundary: Does not add class data, class booking, attendance, capacity, waitlist, new backend calls, or member booking changes.
- Placeholder scan: No deferred-work markers remain. All implementation steps include concrete snippets or exact commands.
- Type consistency: Uses existing `ScheduleViewMode`, `ScheduleTypeFilter`, `scheduleTypeFilters`, `ptVisibleScheduleTypes`, `weekdayLabel`, `dayDate`, `monthKey`, and `getScheduleDaySummary` names already present in the codebase.
