# Design System Specification: Editorial Sonic Minimalism

## 1. Overview & Creative North Star
**Creative North Star: The Immersive Curator**

This design system is not a mere utility; it is a stage. Inspired by the high-contrast, rhythm-driven aesthetic of modern audio-visual platforms, it prioritizes content—specifically large-scale imagery—above structural chrome. We are moving away from "app-like" grids toward an **Editorial Flow**. 

By leveraging intentional asymmetry, oversized typography, and deep tonal layering, we create a premium experience that feels both professional and atmospheric. The system is built on the tension between the void (`surface`) and the vibrant pulse of the content (`primary`). We avoid the "template" look by treating the UI as a series of physical layers where depth is communicated through light and shadow rather than lines.

---

## 2. Colors & Tonal Depth

The palette is anchored in a sophisticated "Obsidian" spectrum, accented by a high-energy "Vibrant Neon" green. 

### The Palette (Material Design 3 Logic)
- **Background & Surface:** `#131313` (Deep Obsidian).
- **Primary Accent:** `#53e076` (Electric Green).
- **Primary Container:** `#1db954` (The iconic brand anchor).
- **Neutral Hierarchy:** A range from `surface_container_lowest` (`#0e0e0e`) to `surface_bright` (`#393939`).

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts.
*   *Example:* A `surface_container_low` section sitting on a `surface` background creates a natural edge. If you feel the need for a line, you haven't used your tonal tokens correctly.

### Surface Hierarchy & Nesting
Treat the UI as a stack of physical materials.
- **Base Layer:** `surface` or `surface_container_lowest`.
- **Primary Content Blocks:** `surface_container`.
- **Elevated Interactions/Modals:** `surface_container_high` or `highest`.
- **The Glass & Gradient Rule:** For floating navigation or context menus, use a semi-transparent `surface_variant` with a `backdrop-blur` (20px–40px). This creates "Glassmorphism" that allows the vibrant colors of album art or hero imagery to bleed through, ensuring the UI feels integrated into the content.

### Signature Textures
Main CTAs and Hero sections should rarely be flat. Use a subtle linear gradient—`primary` to `primary_container`—at a 135-degree angle. This adds a "lithographic" quality that feels expensive and custom.

---

## 3. Typography: Editorial Authority

We use two distinct Sans-serif families to create a high-contrast hierarchy.

### The Scale
- **Display (Plus Jakarta Sans):** Used for "The Big Moment." High tracking (letter-spacing: -0.02em) and bold weights. `display-lg` (3.5rem) should be used for hero headers where the text is as much a visual element as the image.
- **Headline (Plus Jakarta Sans):** Clear, authoritative, and sleek. Use `headline-lg` (2rem) for section titles.
- **Body & Label (Inter):** Chosen for its exceptional legibility at small scales. `body-lg` (1rem) is the workhorse for all descriptions.

**The Editorial Tension:** Pair a `display-lg` header with a `label-md` uppercase sub-header. The extreme difference in scale creates the "Editorial" feel found in premium fashion and music magazines.

---

## 4. Elevation & Depth

We eschew traditional drop shadows for **Tonal Layering**.

### The Layering Principle
Depth is achieved by "stacking" the surface tiers. To make a card feel interactive, do not add a border; instead, move it from `surface_container_low` to `surface_container_high` on hover.

### Ambient Shadows
When an element must float (e.g., a music player bar or a modal), use an **Ambient Shadow**:
- **Color:** A tinted version of the `on_surface` color at 4-8% opacity.
- **Blur:** Large (30px–60px).
- **Spread:** Negative values to keep the shadow tucked under the element. This mimics natural light rather than a digital "drop shadow."

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., input fields), use a **Ghost Border**: the `outline_variant` token at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Buttons: The "Pill" Aesthetic
Utilizing the `full` (9999px) roundedness scale.
- **Primary:** Gradient (`primary` to `primary_container`), `on_primary` text, bold weight.
- **Secondary:** `surface_container_highest` background with `on_surface` text. No border.
- **Tertiary:** No background. Underline only on hover.

### Cards & Lists: The Content-First Approach
- **Rule:** Forbid the use of divider lines.
- **Spacing:** Use the `xl` (3rem) spacing scale between list items to let the content breathe. 
- **Image Treatment:** Use `lg` (2rem) corner radius for large imagery and `sm` (0.5rem) for small thumbnails.

### Input Fields: Minimalist Utility
- **Style:** Background `surface_container_highest`, no border, `sm` (0.5rem) rounding. 
- **Active State:** A 2px bottom-border using the `primary` green.

### Hover States: The "Lift"
Interactive elements should not just change color; they should subtly scale (1.02x) and transition their surface color to a higher tier (e.g., `surface_container` to `surface_bright`).

---

## 6. Do’s and Don’ts

### Do:
- **Do** use massive imagery that bleeds into the `surface` background.
- **Do** utilize negative space. If a layout feels "crowded," double the padding.
- **Do** use the `primary` green sparingly. It is a "laser pointer," not a paint bucket.
- **Do** ensure all text meets AA accessibility standards against the dark backgrounds.

### Don’t:
- **Don’t** use 1px borders. (We mean it.)
- **Don’t** use pure black `#000000`. Use the `surface_container_lowest` (#0e0e0e) for better visual depth.
- **Don’t** use standard "Material" shadows. Stick to Tonal Layering and Ambient Shadows.
- **Don’t** mix the typography. `Plus Jakarta Sans` for headers, `Inter` for data and body. No exceptions.

---

## 7. Implementation Tokens Reference

| Role | Token | Value |
| :--- | :--- | :--- |
| Background | `surface` | #131313 |
| Accent | `primary` | #53e076 |
| Surface Low | `surface_container_low` | #1c1b1b |
| Surface High | `surface_container_high` | #2a2a2a |
| Corner Radius | `md` | 1.5rem |
| Header Font | `display-lg` | Plus Jakarta Sans / 3.5rem |
| Body Font | `body-md` | Inter / 0.875rem |

*This design system is a living philosophy. When in doubt, prioritize the "soul" of the imagery over the structure of the container.*