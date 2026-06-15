# Apple iOS Operations UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing local PT management demo into the approved Apple iOS operations UI direction without changing reservation, payment, member, or policy behavior.

**Architecture:** Keep `components/pt-management-app.tsx` as the single UI component boundary and apply the redesign primarily through `app/globals.css`. JSX changes are limited to semantic grouping/classes where CSS cannot express the selected hierarchy safely. Verification is build plus browser review because this is a visual-only pass and the repo has no UI test harness.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS, lucide-react.

---

## File Structure

- Modify `app/globals.css`: Apple-inspired tokens, typography, grouped surfaces, buttons, pills, slots, forms, responsive layout.
- Modify `components/pt-management-app.tsx`: only if needed for semantic class hooks or accessibility-preserving grouping.
- Modify `STATUS.md`: update current pointer after implementation and verification.
- Do not modify `lib/seed-data.ts`, `lib/types.ts`, `lib/utils.ts`, Supabase files, or product behavior.

## Task 1: CSS Token And App Shell Pass

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace base design tokens**

Set `:root` to the approved Apple iOS operations palette:

```css
:root {
  --bg: #f5f5f7;
  --surface: #ffffff;
  --surface-strong: #fafafc;
  --ink: #1d1d1f;
  --muted: #6e6e73;
  --line: #e0e0e0;
  --line-soft: #f0f0f0;
  --brand: #0066cc;
  --brand-strong: #0071e3;
  --warn: #8a5a00;
  --warn-bg: #fff4d8;
  --danger: #b42318;
  --danger-bg: #ffebe8;
  --good: #1f7a45;
  --good-bg: #e7f6ed;
  --info: #0066cc;
  --info-bg: #eaf4ff;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  --panel-radius: 18px;
  --row-radius: 14px;
  --control-radius: 999px;
}
```

- [ ] **Step 2: Update body and app shell**

Use the platform font stack and make the shell feel like a native grouped iOS surface:

```css
body {
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
}

.app-shell {
  width: min(1480px, 100%);
  margin: 0 auto;
  padding: 12px;
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
}
```

- [ ] **Step 3: Restyle topbar, title, segmented control, and status line**

Keep touch targets at 44px or taller and use frosted sticky chrome on mobile:

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  justify-content: space-between;
  align-items: stretch;
  flex-direction: column;
  gap: 12px;
  margin: -12px -12px 12px;
  padding: calc(12px + env(safe-area-inset-top)) 12px 12px;
  border-bottom: 1px solid rgba(224, 224, 224, 0.72);
  background: rgba(245, 245, 247, 0.86);
  backdrop-filter: blur(18px);
}
```

- [ ] **Step 4: Run build check**

Run: `npm run build`

Expected: build completes successfully.

## Task 2: Grouped Surface And Control Pass

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Restyle top-level grouped panels**

Apply `--panel-radius` only to top-level surfaces:

```css
.task-panel,
.workspace,
.detail-panel,
.section-band,
.member-app {
  border: 1px solid var(--line);
  border-radius: var(--panel-radius);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow);
}
```

- [ ] **Step 2: Restyle repeated rows and slots**

Use `--row-radius`, hairlines, and soft status backgrounds for task rows, member rows, slot cards, metrics, product rows, table rows, settings cards, and available slots.

- [ ] **Step 3: Restyle buttons and form controls**

Primary buttons use Action Blue pills. Secondary and icon buttons use white/soft controls with hairlines and clear focus-visible states.

- [ ] **Step 4: Run build check**

Run: `npm run build`

Expected: build completes successfully.

## Task 3: Responsive And Browser Verification

**Files:**
- Modify: `app/globals.css`
- Modify: `STATUS.md`

- [ ] **Step 1: Verify responsive CSS**

Confirm media queries preserve:

- Mobile: pending panel first, tabs horizontally scroll, no page-wide horizontal overflow.
- Tablet: two-column grids where already present.
- Desktop: sticky pending panel left of workspace.

- [ ] **Step 2: Start local app**

Run: `./Start.sh`

Expected: Next.js dev server reaches Ready and prints a local URL.

- [ ] **Step 3: Browser visual check**

Open the app in browser at mobile and desktop viewport sizes. Confirm:

- Admin and member modes both use the new iOS grouped surface treatment.
- Text does not overflow buttons, pills, slots, or task cards.
- Top controls are at least 44px tall.
- Status pills remain text-labeled and visually distinct.

- [ ] **Step 4: Update `STATUS.md`**

Set the phase to `apple-ios-ui-implemented` and update `Last Verified` with the build and visual check results.

- [ ] **Step 5: Final build check and commit**

Run:

```bash
git diff --check
npm run build
git status --short
```

Expected: diff check and build pass. Only intended files are staged, excluding pre-existing unrelated `next-env.d.ts` changes.

Commit:

```bash
git add app/globals.css components/pt-management-app.tsx STATUS.md docs/superpowers/plans/2026-06-15-apple-ios-operations-ui.md
git commit -m "style: apply apple ios operations ui"
```

## Self-Review

- Spec coverage: covers tokens, typography, grouped surfaces, admin/member views, buttons, status colors, and responsive verification from `docs/superpowers/specs/2026-06-15-apple-ios-operations-ui-design.md`.
- Scope: visual-only, no Supabase/Auth/data behavior changes.
- TDD exception: no behavior unit is introduced; verification is build plus browser review.
