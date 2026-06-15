# Apple iOS Operations UI Design

Date: 2026-06-15
Status: approved for implementation planning

## Context

The project is a mobile-first PT operations app for 강동무에타이장. The newly added `DESIGN.md` is an Apple-inspired design reference with premium white space, SF/system typography, hairline dividers, Action Blue, pill controls, and restrained chrome.

This app should not become an Apple-style marketing page. It is an operations tool used by the owner and members to check reservations, PT passes, payments, and pending work quickly. The Apple reference will be adapted as an iOS-style utility interface.

## Selected Direction

Use the visual direction selected as `A. iOS 운영 앱형`.

The UI should feel like a native iOS management app:

- Light gray app canvas with white grouped surfaces.
- System font stack using Apple platform fonts where available.
- Blue primary actions based on `#0066cc`.
- Thin hairline borders instead of heavy shadows.
- Pill segmented controls for admin/member mode.
- Calm grouped panels with clear metric hierarchy.
- Status colors retained for operational scanning.

Avoid:

- Cinematic hero sections.
- Marketing copy.
- Oversized product-page typography.
- Dark Apple product tiles as the main app layout.
- Low-density decorative cards.

## Product Constraints

Keep the existing product structure from `SPEC.md` and `docs/design.md`:

- Mobile access is first priority.
- First screen remains an actual usable operating screen, not a landing page.
- Admin first flow remains: pending work, weekly schedule, reservation/cancel/session completion handling.
- Member first flow remains: PT status, reservations, available slots.
- Desktop expands the mobile structure instead of introducing a separate product.

## Visual System

### Tokens

Adopt Apple-inspired tokens in `app/globals.css`:

- Canvas: `#f5f5f7`.
- Surface: `#ffffff`.
- Ink: `#1d1d1f`.
- Muted text: `#6e6e73` or nearby Apple muted gray.
- Hairline: `#e0e0e0`.
- Soft divider: `#f0f0f0`.
- Primary action: `#0066cc`.
- Primary focus: `#0071e3`.

Keep semantic status colors, but tune them to softer iOS-like backgrounds:

- Good: green text on soft green.
- Warning/request: amber text on soft amber.
- Danger/cancel: red text on soft red.
- Info: blue text on soft blue.

### Typography

Use the platform font stack:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif
```

Do not use viewport-scaled typography. Use compact operating-tool sizes:

- App title: about 24-28px on mobile.
- Section title: about 20-22px.
- Card title: about 15-17px.
- Body: 14-15px where density matters.
- Captions: 12-13px.

### Shapes and Elevation

- Prefer 16-18px panel radius for top-level grouped iOS surfaces.
- Keep smaller 10-14px radius for repeated rows and slots.
- Buttons and segmented controls may be pill-shaped.
- Remove most heavy shadows. Use borders and subtle background contrast.
- Do not nest visual cards deeply.

## Layout

### App Shell

Use a light gray canvas with a sticky frosted top bar:

- Top bar includes brand, page title, and admin/member segmented control.
- Status line becomes a compact iOS notification strip.
- Main content uses grouped sections rather than heavy cards.

### Admin View

Maintain the current structure:

1. Pending work panel.
2. Admin tabs.
3. Weekly schedule or selected admin workspace.

Mobile:

- Pending work appears first.
- Tabs remain horizontally scrollable.
- Schedule remains a vertical list grouped by day.
- Buttons keep at least 44px touch targets.

Desktop:

- Pending work can become a sticky left column.
- Workspace can expand into columns where useful.
- Do not introduce PC-only workflows.

### Member View

Use the same grouped iOS surface treatment:

- PT summary metrics at the top.
- My reservations below.
- Available slots as clear tappable rows.
- Payment and approval states remain explicit.

## Components

Update existing class-based components rather than adding a new UI library.

Target components:

- `.topbar`
- `.topbar-actions`
- `.segmented`
- `.status-line`
- `.task-panel`
- `.workspace`
- `.tabs`
- `.tab`
- `.slot-card`
- `.member-row`
- `.metric`
- `.detail-panel`
- `.section-band`
- `.member-app`
- `.primary-button`
- `.small-button`
- `.icon-button`
- `.status-pill`
- form controls

The main implementation should be mostly CSS. JSX changes should be limited to class names or small structural wrappers if required for visual hierarchy.

## Testing and Verification

Run:

- `npm run build`
- visual browser check on mobile-sized viewport and desktop viewport

Manual checks:

- No horizontal page overflow on mobile.
- Top controls remain 44px or taller.
- Text does not overflow buttons, pills, slot cards, or task rows.
- Status colors remain distinguishable without relying only on color.
- Admin and member modes are both visually updated.

## Out of Scope

- Supabase/Auth implementation.
- Reservation behavior changes.
- New data model changes.
- Marketing landing page.
- Apple imagery or product-tile hero sections.
