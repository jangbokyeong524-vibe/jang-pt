# Admin Minimal Header Design

## Context

The admin home is an operations screen. On mobile, the first useful content should be the admin workload: pending tasks, member-link approvals, and the weekly summary. The previous admin top area still exposed too much account chrome: a large page title, full email, logout button, and a persistent login success message before the first work card.

## Decision

Use the minimal admin header option.

- The visible header is one compact row.
- Left side: `강동무에타이장` and a small `관리자` pill.
- Right side: compact actions for member-mode switching and account menu.
- Do not show the login email directly in the header.
- Show the login email only inside the account menu as a small pill.
- Keep logout inside the account menu.
- Do not show a persistent login success status-line on admin home.
- Keep operational success/error feedback available only when a real action happens, using a low inline notice or transient message that does not permanently push the first card down.

## Scope

This slice only changes the admin topbar and root status-line behavior. It does not change admin home cards, schedule rows, member compact header, member booking, bottom tabs, or authentication rules.

## Layout Contract

- Admin topbar must not use negative horizontal margin or safe-area top padding.
- Admin topbar must not expose raw `authEmail` in the always-visible header.
- Admin account menu must expose the current email as a pill when opened.
- Admin logout must move into the account menu.
- The persistent status-line must not render for the initial login success message.
- Member mode must remain independent and must not regain the admin topbar/status-line.

## Verification

- Static layout contract covers hidden header email, account-menu email pill, compact header, and status-line suppression for login success.
- Build must pass.
- Manual mobile check should confirm the first admin card moves significantly closer to the viewport top.
