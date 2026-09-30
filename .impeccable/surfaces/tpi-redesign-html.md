---
version: 1
slug: "tpi-redesign-html"
primary_target: "tpi-redesign.html"
related_targets: []
---

# Desafíos (redesign mock)

Scope: student challenge list inside the TPI 2026 app shell. Mode: Operate.
Audience/job: student decides what to solve next; obligatorios drive regularity.
Data (confirmed): tipo, dificultad, título, curso, estado (pendiente/en curso/completado), recompensa XP+monedas, obligatorio/opcional, fecha límite.
Constraints: @2026-p4-fe/ui components and tokens only; arcade + normal (sobrio palette from tpi-ui-mock.html) × light/dark; WCAG AA.

## Direction contract

THESIS: A to-do queue ordered by urgency, not a same-size card wall. Refuses the 4-column card grid with repeated type badges.
OWN-WORLD: Library tokens from tpi-ui-mock.html. Arcade: Silkscreen display, 2px borders, pixel corner studs, stepped motion. Normal: sobrio blue/gray, Plex, 1px borders, 8px radius.
STORY: The student sees risk first, then what is in progress, then what is due this week, and can filter by course, type, difficulty, or obligatorio.
FIRST VIEWPORT: Sidebar shell left. Title + one-line purpose. Risk alert with "Ver solo obligatorios". Tabs Por hacer/Completados, filter bar, then grouped dense rows (status, title+course·type, obligatorio+difficulty meter, deadline, reward, action).
FORM: Pinned by user (existing mock world); no concept roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
