# Samsung One UI -- DESIGN.md

An AI-readable design system specification for Samsung One UI, formatted as a structured DESIGN.md file following the Google Stitch standard.

## What is this?

This package contains a complete design system reference for Samsung One UI -- Samsung's human-centered interface language built on the philosophy of "Focus on what matters." It covers color tokens, typography hierarchy, component specifications, spacing scales, elevation levels, responsive breakpoints, foldable device support, and accessibility guidelines.

The DESIGN.md file is designed to be consumed by AI coding agents (Claude, Cursor, Copilot, etc.) so they can generate Samsung One UI-compliant interfaces without manual design handoff.

## Files included

- **DESIGN.md** -- The full design system specification (colors, typography, components, layout, elevation, do's/don'ts, responsive behavior, agent prompt guide)
- **preview.html** -- Visual catalog of all design tokens and components in light mode
- **preview-dark.html** -- Visual catalog of all design tokens and components in dark mode

## How to use

1. Copy `DESIGN.md` into your project root (or any directory your AI agent can access).
2. Instruct your AI agent to reference `DESIGN.md` when generating UI code.
3. Open `preview.html` or `preview-dark.html` in a browser to visually verify tokens and component styles.

Example agent instruction:

```
Read DESIGN.md and use it as the design system reference for all UI components in this project. Follow Samsung One UI specifications for colors, typography, spacing, and component styles.
```

## Credits

- Samsung One UI Design System: https://developer.samsung.com/one-ui
- DESIGN.md format standard: Google Stitch (AI-readable design specification)
