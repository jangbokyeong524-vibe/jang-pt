# Week Schedule Bottom Tabs IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the local demo UI so admin/member screens use bottom tabs and weekly schedules show all seven days at once.

**Architecture:** Keep the existing single client component and local seed-state model. Add separate admin/member tab state, reuse current actions, and introduce compact weekly schedule components for admin and member flows.

**Tech Stack:** Next.js, React client state, TypeScript, CSS modules via `app/globals.css`, local demo data in `lib/seed-data.ts`.

---

### Task 1: Admin and Member Tab State

**Files:**
- Modify: `components/pt-management-app.tsx`

- [ ] Replace the current `AdminTab` union with `home | week | members | settings | summary`.
- [ ] Add `MemberTab` as `home | booking | history`.
- [ ] Keep the top admin/member switch for demo checking, but do not treat it as the final auth model.
- [ ] Route admin tabs to Home, Week, Members, Settings, CRM views.
- [ ] Route member tabs to Home, Booking, History views.

### Task 2: Seven-Day Weekly Schedule

**Files:**
- Modify: `components/pt-management-app.tsx`
- Modify: `app/globals.css`

- [ ] Add a helper that returns exactly seven days from the earliest visible slot day.
- [ ] Render the admin weekly detail as seven day columns with compact slot cards.
- [ ] Render the admin home with processing tasks first and a smaller seven-day weekly summary below.
- [ ] Render member booking with the same seven-day shape, showing open slots as request buttons.
- [ ] Keep existing reservation approval, rejection, completion, cancellation, and late-cancel actions wired.

### Task 3: Member History

**Files:**
- Modify: `components/pt-management-app.tsx`

- [ ] Move member PT summary into the member home tab.
- [ ] Add member history content that includes active pass details, payment status/date, reservation history, and pass events.
- [ ] Preserve the demo member account selector until the auth work replaces it.

### Task 4: Docs, Verification, Commit

**Files:**
- Modify: `SPEC.md`
- Modify: `docs/design.md`
- Modify: `STATUS.md`

- [ ] Update docs to say the final product is account/role split, while the current top switch remains for development/demo review.
- [ ] Update UI docs for admin five bottom tabs and member three bottom tabs.
- [ ] Run `npm run build`.
- [ ] Commit only the intended files, excluding unrelated `next-env.d.ts` and `.superpowers/` brainstorm artifacts.
