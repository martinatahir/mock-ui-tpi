# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Angular 21 (standalone, zoneless) + Tailwind, built on the faculty component library `@2026-p4-fe/ui` (theme tokens from `theme.css` v0.3.2). The HTML in this folder is a design guide, not production code.

## Users

Two primary audiences with equal weight:

- **Students (alumnos)** of Programación IV (UTN FRC): complete challenges, follow their roadmap, earn coins and badges, spend them in the marketplace, and customize their 3D avatar that appears in the islands/hex world.
- **Professors (profesores)**: manage courses and cohorts (active, drafts, archived), follow student progress, and run course content.

Secondary: **administrators** (backoffice: user management, account approval, global configuration, badge catalog).

## Product Purpose

TPI 2026 is a gamified learning platform for the Programación IV course. Success means students stay engaged with the course through game mechanics while professors can manage cohorts and content without friction.

## Positioning

The course itself is framed as a game world: a 3D and hexagonal course map, personal avatars, a virtual-currency bank, and a marketplace that sit alongside real academic tooling such as cohorts, surveys, and an AI tutor.

## Operating Context

- Navigation areas (from current UI): Dashboard, Courses, Challenges, AI Tutor, Accounting/Bank, Marketplace, Roadmap, Ranking, Chat, Notifications, Surveys, Profile, Admin/Backoffice.
- Auth and onboarding flows: login, GitHub callback, sign-up, account pending/under review, account activation, password recovery, avatar selection.
- Two presentation modes: **modo arcade** (the gamer/pixel look used today) and **modo normal** (a calmer professor-world look, called "sobrio" in the mock).

## Capabilities and Constraints

- **Hard constraint:** redesigns must never step outside the components of the faculty library `@2026-p4-fe/ui`. Extend through its tokens and components; do not replace them or introduce a parallel component set.
- Both **modo arcade** and **modo normal** must be supported.
- **Light and dark** themes are both required, in both modes.
- Implementation target is Angular 21 + Tailwind.
- Scope of current work: the real pages shown in the screenshots are the pages to redesign. `tpi-ui-mock.html` is an approximate guide to the intended direction (sidebar shell, dashboard as the real home), not a final spec.

## Brand Commitments

- Product name: **TPI 2026**. UI copy is Spanish (Rioplatense voseo, e.g. "Visualizá y gestioná…", "Elegí tu avatar").
- Existing mode names: modo arcade / modo normal (also "Modo juego" / "Modo profesor" in the mock).

## Evidence on Hand

- `Captura de pantalla 2026-09-30 *.png` (12 files): screenshots of the current production pages to redesign.
- `tpi-ui-mock.html`: navigation and direction mock with arcade/normal skins and light/dark tokens copied from `@2026-p4-fe/ui`.
- No testimonials, usage metrics, or user research are on hand; do not fabricate them.

## Product Principles

1. Two first-class worlds: the student game experience and the professor management experience get equal care, and neither is a reskin afterthought of the other.
2. The library is the floor: every screen is composed from `@2026-p4-fe/ui`, so improvements happen through tokens, composition, and hierarchy.
3. Game mechanics serve learning: coins, badges, avatars, and maps motivate progress through the course and do not bury academic tasks.
4. Mode and theme are orthogonal: any page works in arcade or normal mode, in light or dark.

## Accessibility & Inclusion

WCAG 2.1 AA minimum (contrast, visible focus, full keyboard operation) in all four combinations of mode and theme.
