# Design System: Samsung One UI

## 1. Visual Theme & Atmosphere

Samsung One UI is a design system built on the philosophy of **"Focus on what matters"** — a human-centered approach that prioritizes comfort, reachability, and clarity across Samsung's ecosystem of phones, foldables, tablets, watches, and TVs. Unlike flat minimalism or material layering, One UI creates a distinctly warm, rounded, and approachable interface where content lives in the upper viewing zone and interactive elements cluster in the lower interaction zone, reachable with one hand even on large displays.

The visual language is soft and confident. Rounded rectangles with generous corner radii define every surface — from app icons to cards to dialogs. Colors are rich and solid with controlled brightness and saturation, anchored by Samsung Blue as the primary accent. Backgrounds default to clean whites (light mode) or deep near-blacks (dark mode) with subtle surface elevation through blur, dim overlays, and restrained shadows. The overall impression is calm spaciousness: wide margins give content room to breathe, focus blocks group related information into scannable clusters, and typography scales gracefully from large center-aligned titles in the viewing area to compact, functional labels in the interaction zone.

One UI is opinionated about density — it is deliberately less dense than stock Android, trading information density for touch comfort and visual rest. Every pixel of whitespace is intentional, creating the "impression of open space" that Samsung describes as fundamental to the system.

**Key Characteristics:**
- Two-zone layout: viewing area (top, non-interactive) and interaction area (bottom, reachable)
- SamsungOne / One UI Sans type family with optical weight variation across display and body contexts
- Samsung Blue (`#0381FE`) as the singular primary accent, symbolizing trust and stability
- Rounded square app icons with soft corners projecting warmth and approachability
- Rich, solid colors with controlled brightness and saturation — never garish, never flat
- Generous margins (minimum 24dp side margins) creating open, breathable layouts
- Blur + dim overlays for depth instead of heavy drop shadows
- Dark mode as a first-class citizen, not an afterthought — tested and tuned independently
- Foldable-aware responsive layouts supporting Galaxy Z Fold, Z Flip, and Flex Mode

## 2. Color Palette & Roles

### Primary Accent

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| **Primary** | `#0381FE` | `#0381FE` | Floating action buttons, sliders, primary interactive elements |
| **Primary Dark** | `#0072DE` | `#3E91FF` | Contained button backgrounds, sub-text highlights |
| **Control Activated** | `#3E91FF` | `#3E91FF` | Checkboxes, toggles (on state), radio buttons, switches |

### Background & Surface

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| **Background** | `#FFFFFF` | `#000000` | Primary app background |
| **Surface** | `#F6F6F6` | `#1A1A1A` | Cards, focus blocks, elevated containers |
| **Surface Variant** | `#EEEEEE` | `#2A2A2A` | Secondary cards, grouped list backgrounds |
| **Surface Elevated** | `#FFFFFF` | `#252525` | Dialogs, bottom sheets, popovers |
| **Scrim** | `rgba(0, 0, 0, 0.32)` | `rgba(0, 0, 0, 0.64)` | Dialog/bottom sheet overlay backdrop |

### Text & Icon

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| **On Background** | `#000000` | `#FFFFFF` | Primary text on backgrounds |
| **On Background Secondary** | `#666666` | `#999999` | Secondary/supporting text |
| **On Background Tertiary** | `#999999` | `#666666` | Hint text, placeholders, disabled text |
| **On Primary** | `#FFFFFF` | `#FFFFFF` | Text on primary-colored surfaces |
| **On Surface** | `#000000` | `#FFFFFF` | Text on cards and elevated surfaces |
| **Icon Default** | `#252525` | `#DEDEDE` | Standard icon tint |
| **Icon Secondary** | `#8C8C8C` | `#787878` | Secondary/inactive icon tint |

### Semantic / Informative

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| **Positive / Accept** | `#0AA64E` | `#2BD671` | Success states, confirmations, accept actions |
| **Negative / Reject** | `#D93B30` | `#FF6E6E` | Error states, destructive actions, reject |
| **Warning** | `#E89500` | `#FFB74D` | Caution states, warnings |
| **Informative** | `#0072DE` | `#5BA6FF` | Informational banners, tips |
| **Notification Badge** | `#FF2D2D` | `#FF4D4D` | Unread count badges |

### Focus Block Types

| Type | Light Mode | Dark Mode | Usage |
|------|-----------|-----------|-------|
| **Type 1 (Monotone)** | `#F6F6F6` | `#1A1A1A` | Standard function-driven content (most common) |
| **Type 2 (Tinted)** | Light tint of app accent | Dark tint of app accent | Toggle sections, highlighted settings |
| **Type 3 (Gradient)** | Analogous 2-3 color gradient | Muted analogous gradient | Decorative headers (use sparingly) |

### Samsung Brand

| Color | Hex | Usage |
|-------|-----|-------|
| **Samsung Blue** | `#1428A0` | Samsung corporate brand mark |
| **One UI Blue** | `#0381FE` | One UI system accent |
| **Galaxy Blue** | `#2196F3` | Galaxy ecosystem marketing |

### Design Principles for Color
- Blue symbolizes trust, hope, and stability — it is One UI's foundational accent
- Three tonal variations of primary blue provide hierarchy without introducing new hues
- Informative/semantic colors maintain consistency across light and dark modes
- Background gradients use analogous colors only (max 3 stops) to avoid visual complexity
- Dark mode is not simply an inversion — each token is independently tuned for contrast and comfort
- Always test both light and dark modes before release

## 3. Typography Rules

### Font Family

| Context | Font | Fallbacks |
|---------|------|-----------|
| **Display / Headings** | SamsungOne (or One UI Sans) | Samsung Sharp Sans, SamsungSS Head, Roboto, sans-serif |
| **Body / UI** | SamsungOne (or One UI Sans) | SamsungSS Body, Roboto, sans-serif |
| **Monospace / Code** | Samsung Mono | Roboto Mono, monospace |

Samsung preloads multiple optical variants:
- **SamsungSS Head**: Light (300), Regular (400), Medium (500), Bold (700) — optimized for large display sizes
- **SamsungSS Body**: Light (300), Regular (400), Bold (700) — optimized for reading at small sizes

### Hierarchy

| Role | Font Variant | Size | Weight | Line Height | Letter Spacing | Usage |
|------|-------------|------|--------|-------------|----------------|-------|
| Display Hero | SS Head | 34sp | 700 (Bold) | 1.15 | -0.5px | App launch titles, onboarding headlines |
| Page Title | SS Head | 28sp | 700 (Bold) | 1.20 | -0.3px | Expanded app bar title (viewing area) |
| Section Title | SS Head | 22sp | 500 (Medium) | 1.25 | -0.2px | Focus block headers, section labels |
| Card Title | SS Head | 18sp | 500 (Medium) | 1.30 | normal | Card headings, list group titles |
| Subtitle | SS Body | 16sp | 700 (Bold) | 1.35 | normal | Emphasized body, toolbar titles |
| Body 1 | SS Body | 16sp | 400 (Regular) | 1.50 | normal | Primary reading text |
| Body 2 | SS Body | 14sp | 400 (Regular) | 1.45 | 0.1px | Secondary text, descriptions |
| Caption | SS Body | 12sp | 400 (Regular) | 1.35 | 0.2px | Timestamps, metadata, helper text |
| Overline | SS Body | 11sp | 500 (Medium) | 1.30 | 0.5px | Category labels, section overlines (uppercase) |
| Button | SS Body | 14sp | 500 (Medium) | 1.00 | 0.2px | Button labels |
| Micro | SS Body | 10sp | 400 (Regular) | 1.30 | 0.3px | Legal text, badge counts |

### Principles
- **Viewing vs. Interaction typography**: Large, center-aligned titles in the viewing area (top) create visual anchors; compact, left-aligned functional text in the interaction area (bottom) enables quick scanning
- **Weight restraint**: Display uses Bold (700) and Medium (500); body text lives at Regular (400) — weight 300 (Light) appears only in decorative or large promotional contexts
- **Accessibility scaling**: All text (except subtitles and text within images) must be resizable up to 200% without loss of content or functionality. Layouts must accommodate Level 3 through Level 7 font size preferences
- **Maximum line length**: List items recommend 31 characters maximum to prevent line wrapping on compact screens
- **Optical sizing**: SamsungSS Head variants have wider proportions optimized for display sizes; Body variants are tighter and sturdier for reading contexts — similar to SF Pro's optical sizing approach

## 4. Component Stylings

### Buttons

**Contained Button (High Emphasis)**
- Background: Primary Dark (`#0072DE` light / `#3E91FF` dark)
- Text: `#FFFFFF`
- Height: 48dp
- Padding: 16dp horizontal, 12dp vertical
- Radius: 18dp
- Font: SS Body, 14sp, Medium (500)
- Pressed: 10% darker background
- Disabled: 38% opacity
- Usage: Primary CTA, one per screen recommended

**Contained Button (Medium Emphasis)**
- Background: `#E0E0E0` (light) / `#404040` (dark)
- Text: `#000000` (light) / `#FFFFFF` (dark)
- Height: 48dp
- Radius: 18dp
- Font: SS Body, 14sp, Medium (500)
- Usage: Secondary actions alongside a high-emphasis button

**Flat Button (Low Emphasis)**
- Background: transparent
- Text: Primary (`#0381FE`)
- Height: 48dp
- Padding: 12dp horizontal
- Radius: 18dp
- Font: SS Body, 14sp, Medium (500)
- Usage: Tertiary actions, dialog actions, toolbar buttons

**Floating Action Button (FAB)**
- Background: Primary (`#0381FE`)
- Icon: `#FFFFFF`, 24dp
- Size: 56dp diameter
- Radius: 16dp (rounded square, not circle)
- Elevation: 6dp
- Shadow: `rgba(0, 0, 0, 0.15) 0dp 3dp 8dp`
- Position: Bottom-right, 16dp from edges
- Usage: Primary screen action (compose, add, create)

**Icon Button**
- Size: 48dp touch target, 24dp icon
- Tint: Icon Default token
- Pressed: ripple with `?attr/colorControlHighlight`
- Usage: App bar actions, toolbar icons

### App Bar

**Standard (Collapsed)**
- Height: 56dp
- Title: SS Head, 18sp, Medium (500), left-aligned
- Back/nav icon: 24dp, left side
- Action icons: 24dp, right side (max 3)
- Overflow: more-options icon far right
- Background: Surface or transparent
- Elevation: 0dp (scrolled content passes underneath with no shadow)

**Extended (Expanded)**
- Height: 152dp (collapsible)
- Title: SS Head, 28sp, Bold (700), center-aligned in viewing area
- Collapses to standard height on scroll
- Dynamic title support: unread counts, next alarm, quick links
- Up to 2 action buttons below title text

### Bottom Navigation

- Height: 56dp
- Items: text-only labels (no icons in One UI style)
- Max items: 5 (recommended: 4 or fewer)
- Active: Primary color text
- Inactive: On Background Secondary text
- Font: SS Body, 12sp, Medium (500)
- No swipe between tabs (One UI rule)
- Can replace top title when tabs are present

### Bottom Bar (Toolbar)

- Height: 56dp
- Max buttons: 5 (with overflow for additional)
- Min buttons: 2 (single button not allowed)
- Buttons: icon + text label
- Hides on scroll down, reappears on scroll up
- Background: Surface color

### Dialog

**Choice / Confirmation Dialog**
- Position: bottom of screen (Samsung gravity)
- Width: screen width minus 48dp margins
- Radius: 26dp (top corners), 0dp (bottom, flush with screen edge)
- Padding: 24dp
- Title: SS Head, 18sp, Bold (700)
- Body: SS Body, 14sp, Regular (400)
- Buttons: right-aligned, flat style
- Scrim: Background Scrim token
- Implementation: `AlertDialog.Builder` with `setGravity(Gravity.Bottom)`

**Information Dialog**
- Position: centered on screen
- Radius: 26dp (all corners)
- Same typography and padding as choice dialog

### Cards

- Background: Surface token
- Radius: 16dp
- Padding: 16dp internal
- Elevation: 0dp default (flat), subtle shadow on interaction
- Dividers: 1dp, `#E0E0E0` (light) / `#333333` (dark)
- Content formats: image+text, text-only, thumbnail, clustered images

### Lists

- Row height: 56dp (single-line), 72dp (two-line), 88dp (three-line)
- Padding: 24dp horizontal (matching screen margins)
- Leading: icon/avatar 40dp, or thumbnail 56dp
- Trailing: toggle switch, checkbox, or text
- Title: SS Body, 16sp, Regular (400), max 31 characters
- Subtitle: SS Body, 14sp, Regular (400), On Background Secondary
- Dividers: 1dp between items, inset from leading element
- Sub-headers for grouping related settings

### Search

- Height: 48dp
- Radius: 24dp (full pill)
- Background: Surface Variant
- Icon: 24dp search icon, left-aligned
- Text: SS Body, 16sp, Regular (400), hint in Tertiary color
- Autocomplete and predictive text support
- Recent searches and contextual suggestions

### Toast / Snackbar

**Toast**
- Position: bottom center, above bottom navigation
- Max lines: 1 (recommended), 3 (absolute max)
- Radius: 24dp
- Background: `#323232` (both modes)
- Text: `#FFFFFF`, SS Body, 14sp
- Duration: short (2s) or long (3.5s)
- No interactive elements

**Snackbar**
- Position: bottom, full width minus margins
- Action button: right side, flat, Primary color text
- Auto-dismisses after timeout or user interaction

**Label Toast (Tooltip)**
- Appears on icon touch-and-hold
- Small word bubble near the touched element
- Disappears on release

### Switches & Toggles

- Track width: 52dp
- Track height: 32dp
- Thumb diameter: 28dp
- Active: Control Activated (`#3E91FF`) track
- Inactive: `#CCCCCC` (light) / `#555555` (dark) track
- Radius: 16dp (full pill track)

## 5. Layout Principles

### The Two-Zone Model

One UI's most distinctive layout principle: every screen divides into two conceptual zones.

**Viewing Area (Top)**
- Non-interactive content: titles, headers, imagery, informational text
- Wide margins creating "open space" impression
- Center-aligned typography for visual stability
- Scrolls away naturally as user engages with content

**Interaction Area (Bottom)**
- Actionable components grouped in logical order
- Tighter margins to focus attention on grouped controls
- Left-aligned functional text for scanning efficiency
- Reachable with one thumb on devices up to 6.8"

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-2` | 2dp | Micro-adjustments, icon optical alignment |
| `space-4` | 4dp | Compact internal padding, badge offsets |
| `space-8` | 8dp | Base unit, small gaps between related elements |
| `space-12` | 12dp | Button internal vertical padding |
| `space-16` | 16dp | Standard internal card padding, FAB margin |
| `space-20` | 20dp | Section spacing within focus blocks |
| `space-24` | 24dp | Screen side margins (minimum), list row horizontal padding |
| `space-32` | 32dp | Section dividers, large vertical gaps |
| `space-48` | 48dp | Dialog horizontal margin (24dp per side), major section breaks |
| `space-64` | 64dp | Viewing area to interaction area transition gap |

### Grid System

| Layout | Columns | Margins | Gutter | Usage |
|--------|---------|---------|--------|-------|
| List Grid | 1 | 24dp | n/a | Settings, messages, contacts |
| Card Grid | 2 | 24dp | 12dp | Gallery, app grid |
| 2-Column | 2 | 24dp | 16dp | Side-by-side content panels |
| 3-Column | 3 | 24dp | 12dp | Small cards, icon grids |
| Large Screen | 2-3 | 24-32dp | 16-24dp | Tablet and foldable layouts |

### Touch Safety

- **Reject zones**: Block accidental touches in defined screen-edge areas
- **Grip zones**: Prevent palm and three-finger input during normal phone handling
- **Cutout awareness**: Content repositions around camera cutouts; different handling for 90 and 270-degree orientations

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8dp | Small containers, inline tags |
| `radius-md` | 12dp | Medium cards, image containers |
| `radius-lg` | 16dp | Cards, FAB, standard containers |
| `radius-xl` | 18dp | Buttons |
| `radius-2xl` | 24dp | Search bars, toasts (pill) |
| `radius-3xl` | 26dp | Dialogs, bottom sheets |
| `radius-full` | 50% | Avatars, circular icon buttons |
| **App Icon** | Squircle (superellipse) | App icon background shape — rounded square with continuous curvature |

### Focus Blocks

Content is organized into "focus blocks" — visually distinct groupings with their own background and margins:

- **Multiple Cards**: Various internal layouts (image+text divided, image+text, text-only, clustered)
- **Grouped Lists**: Settings-style rows (text, thumbnail, icon variants)
- **Singular Content**: Hero thumbnails or embedded card content

Margins are "optimized for each of the 3 different types of focus blocks" to provide appropriate visual weight.

## 6. Depth & Elevation

| Level | Elevation | Treatment | Usage |
|-------|-----------|-----------|-------|
| **Ground (Level 0)** | 0dp | No shadow, solid background color | Page background, standard content areas |
| **Surface (Level 1)** | 1dp | Subtle background color shift only | Cards, focus blocks, list groups |
| **Raised (Level 2)** | 4dp | Soft shadow: `rgba(0, 0, 0, 0.08) 0dp 2dp 6dp` | Bottom bar, app bar on scroll |
| **Floating (Level 3)** | 6dp | Medium shadow: `rgba(0, 0, 0, 0.15) 0dp 3dp 8dp` | FAB, floating buttons |
| **Overlay (Level 4)** | 8dp | Shadow + scrim backdrop | Bottom sheets, dialogs |
| **Modal (Level 5)** | 12dp | Shadow + full scrim: `rgba(0, 0, 0, 0.32)` | Confirmation dialogs, critical alerts |

### Blur Effect
- Applied evenly across the background when content overlays appear
- Combined with light dim (light mode) or dark dim (dark mode)
- **White dim**: used in light mode to maintain readability beneath overlays
- **Dark dim**: used in dark mode for the same purpose
- Never combine blur + shadow simultaneously — use one or the other to avoid visual fatigue

### Shadow Philosophy
- Shadows are "light and clean" — soft, diffused, minimal offset
- Shadows "should not be seen as having 3D depth" — they indicate relationship and hierarchy, not physical elevation
- One UI strongly prefers background color differentiation and blur over shadow for expressing depth
- When shadow is used, it is always a single, soft, wide-blur shadow — never multiple stacked layers

### Decorative Depth
- Focus blocks use background color to separate from page background (color-based depth)
- Dialogs at screen bottom use corner radius + scrim to float above content
- Blur effect emphasizes "current information" by de-emphasizing everything behind it

## 7. Do's and Don'ts

### Do
- Place interactive elements in the lower interaction zone for one-handed reachability
- Use Samsung Blue (`#0381FE`) as the primary accent — it conveys trust and stability
- Maintain at least 24dp side margins on all screens to create open, breathable layouts
- Use only one high-emphasis button style per screen to establish clear visual priority
- Test both Light and Dark modes independently before release — they are not simple inversions
- Use monotone (Type 1) focus blocks for most content — gradients (Type 3) are reserved for rare decorative moments
- Respect reject zones and grip zones to prevent accidental touches
- Design for 200% text scaling — ensure layouts accommodate Level 7 font sizes without breaking
- Use sub-headers in lists to group related settings for easier scanning
- Apply 18dp border radius on buttons consistently — this is the One UI button signature
- Keep icon backgrounds as rounded squares with continuous-curvature corners (squircle)
- Maintain 4.5:1 contrast ratio for small text and 3:1 for large text (18dp+ normal or 14dp+ bold)
- Provide additional visual marks alongside color coding for colorblind accessibility
- Add tooltip labels on icon touch-and-hold for accessibility

### Don't
- Don't place critical interactive elements in the upper viewing area — it is for display, not touch
- Don't use more than 3 colors in background gradients — keep analogous, max 3 stops
- Don't display only one button in the bottom toolbar — minimum is 2
- Don't allow more than 5 items in bottom navigation (4 recommended)
- Don't enable swipe-between-tabs — One UI explicitly disables this pattern
- Don't use heavy or multiple-layer shadows — One UI depth comes from color and blur, not shadow
- Don't combine dim overlays with shadow effects simultaneously — choose one
- Don't exceed 31 characters for list item main text — it causes line wrapping on compact screens
- Don't use toasts for critical information — they are for "relatively minor" feedback only
- Don't exceed 3 lines in toast messages under any circumstances
- Don't ignore camera cutout positioning — content must reflow around cutouts at all orientations
- Don't apply 3D-looking shadows — shadows indicate hierarchy relationships, not physical depth
- Don't rely on color alone to convey information — always supplement with icons, text, or patterns
- Don't skip testing with grayscale mode to verify information clarity without color

## 8. Responsive Behavior

### Window Size Classes

| Class | Width | Devices | Layout Adaptation |
|-------|-------|---------|-------------------|
| **Compact** | < 600dp | Phone (portrait), Z Flip cover | Single column, standard 24dp margins, full bottom interaction zone |
| **Medium** | 600-839dp | Z Fold (portrait/landscape), small tablet (portrait), phone (landscape) | Side-by-side menus, expanded grids, contextual dialogs |
| **Expanded** | >= 840dp | Tablet (portrait/landscape), Samsung DeX, external monitor | Multi-panel layout, navigation rail, reachable right-side controls |

### Large Screen Adaptations (600dp+)

| Pattern | Description |
|---------|-------------|
| **Side-by-Side Menus** | Navigation visible alongside content — no screen switching needed |
| **Grid Expansion** | Grid structures expand to show more items simultaneously |
| **Contextual Dialogs** | Small pop-ups replace full-screen overlays to maintain context |
| **Reachable Controls** | Interactive elements shift to right side instead of bottom for comfortable tablet holding |

### Foldable Device Support

**Galaxy Z Fold**
- Cover screen (Compact): Standard phone layout
- Unfolded (Medium/Expanded): Dual-pane or expanded layout
- Apps must be resizable and support seamless transition between cover and main screen
- Preserve scroll position, text input, and keyboard state during fold/unfold transitions
- Avoid placing interactive elements near the center crease

**Galaxy Z Flip**
- Standard mode: Regular Compact layout
- Flex Mode (partially folded): Content on top half (angled up), controls on bottom half (flat on surface)
- Top half: viewing area (camera viewfinder, video player, content)
- Bottom half: interaction area (controls, buttons, settings)

**Multi-Window**
- Split-screen support required for all apps
- Pop-up view from Recents and Edge Panel
- Content must reflow gracefully at any window size
- Never assume fixed screen dimensions

### Samsung DeX (Desktop Mode)
- Apps run in resizable windows on external monitors
- Layout should adapt to arbitrary window dimensions
- Support standard desktop patterns: resize, minimize, maximize
- Mouse and keyboard input modes

### Touch Targets
- Minimum touch target: 48dp x 48dp
- Sufficient spacing between targets to prevent missed touches
- Pop-up labels on icon touch-and-hold for accessibility
- Touch areas must accommodate users with limited mobility

### Animation Behavior
- Duration range: 100ms (minimum perceivable) to 500ms (maximum before interfering with next task)
- Easing: One UI Path Interpolator `[0.22, 0.25, 0.00, 1.00]` — quick acceleration, gradual deceleration
- Linear easing only for transparency changes and dissolves
- Overlapping image fades (new image appears before old fully disappears)
- Text transitions: old text must fully disappear before new text fades in (no overlap)
- Motions respond instantly to touch input — no delay

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary accent: Samsung Blue (`#0381FE`)
- Primary Dark: `#0072DE` (light) / `#3E91FF` (dark)
- Control Activated: `#3E91FF`
- Background: `#FFFFFF` (light) / `#000000` (dark)
- Surface: `#F6F6F6` (light) / `#1A1A1A` (dark)
- Text primary: `#000000` (light) / `#FFFFFF` (dark)
- Text secondary: `#666666` (light) / `#999999` (dark)
- Positive: `#0AA64E` (light) / `#2BD671` (dark)
- Negative: `#D93B30` (light) / `#FF6E6E` (dark)
- Warning: `#E89500` (light) / `#FFB74D` (dark)
- Scrim: `rgba(0, 0, 0, 0.32)` (light) / `rgba(0, 0, 0, 0.64)` (dark)

### Quick Typography Reference
- Display: SamsungOne / SS Head, 34sp, Bold (700), line-height 1.15
- Page Title: SS Head, 28sp, Bold (700), line-height 1.20
- Body: SS Body, 16sp, Regular (400), line-height 1.50
- Button: SS Body, 14sp, Medium (500)
- Caption: SS Body, 12sp, Regular (400)

### Quick Spacing Reference
- Screen margins: 24dp minimum
- Button radius: 18dp
- Card radius: 16dp
- Dialog radius: 26dp
- Standard padding: 16dp
- Base unit: 8dp

### Example Component Prompts

- "Create a One UI settings screen. White background (#FFFFFF). App bar at top: 56dp height, SS Head 18sp Medium, left-aligned title with 24dp back arrow. Below: grouped list rows at 56dp height each, 24dp horizontal padding, SS Body 16sp Regular for titles, toggle switches on right side (52dp wide, 32dp tall, #3E91FF active track). Sub-headers in SS Body 14sp Medium, Primary color, 24dp left margin."

- "Design a One UI dialog anchored to screen bottom. Width: screen width minus 48dp. Top corners: 26dp radius, bottom flush. Scrim: rgba(0,0,0,0.32). Internal padding: 24dp. Title: SS Head 18sp Bold. Body: SS Body 14sp Regular, #666666. Two flat buttons right-aligned: 'Cancel' in #666666, 'Confirm' in #0381FE, both 14sp Medium."

- "Build a One UI card grid. Background: #F6F6F6. 2-column grid with 24dp side margins, 12dp gutter. Cards: #FFFFFF background, 16dp border radius, 16dp internal padding, no shadow. Card image fills top section. Title: SS Head 18sp Medium below image. Description: SS Body 14sp Regular, #666666."

- "Create a One UI FAB. Size: 56dp. Background: #0381FE. Icon: white, 24dp. Radius: 16dp (rounded square, not circle). Shadow: rgba(0,0,0,0.15) 0dp 3dp 8dp. Position: bottom-right, 16dp from screen edges. Pressed state: 10% darker blue."

- "Design a Flex Mode layout for Galaxy Z Flip. Top half (angled screen): video player or camera viewfinder filling the space. Bottom half (flat on surface): playback controls centered, 48dp touch targets, 24dp margins. Divider at fold line: subtle 1dp line. Background: #000000 for media-centric experience."

### Iteration Checklist

1. Interactive elements belong in the bottom interaction zone — reachable with one thumb
2. One high-emphasis button per screen maximum — use medium/low emphasis for secondary actions
3. Buttons get 18dp radius, cards get 16dp, dialogs get 26dp — the radius hierarchy is intentional
4. Minimum 24dp side margins everywhere — One UI is spacious, never cramped
5. Samsung Blue (`#0381FE`) is the only accent — do not introduce additional chromatic accents
6. Dark mode tokens are independently tuned — never just invert light mode colors
7. Shadows are soft and singular — never multiple layers, never 3D-looking
8. Blur + dim for overlays, NOT shadow + dim — never combine both
9. Test at 200% text scale — layouts must not break
10. Foldable support: preserve state across fold/unfold, avoid elements near the crease
11. Bottom navigation is text-only, max 5 items, no swipe — these are hard One UI rules
12. Animation easing: `[0.22, 0.25, 0.00, 1.00]` — quick in, gradual out, 100-500ms range
13. Toast messages: 1 line ideal, 3 lines absolute max, minor info only
14. List text: 31 characters max to prevent wrapping on compact screens
15. Always provide non-color indicators alongside color for accessibility
