---
name: Kinetic Engineering
colors:
  surface: '#121319'
  surface-dim: '#121319'
  surface-bright: '#393840'
  surface-container-lowest: '#0d0e14'
  surface-container-low: '#1b1b22'
  surface-container: '#1f1f26'
  surface-container-high: '#292930'
  surface-container-highest: '#34343b'
  on-surface: '#e4e1eb'
  on-surface-variant: '#c6c5d5'
  inverse-surface: '#e4e1eb'
  inverse-on-surface: '#303037'
  outline: '#908f9e'
  outline-variant: '#454653'
  surface-tint: '#bdc2ff'
  primary: '#bdc2ff'
  on-primary: '#131e8c'
  primary-container: '#818cf8'
  on-primary-container: '#101b8a'
  inverse-primary: '#4953bc'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#f7bd3e'
  on-tertiary: '#402d00'
  tertiary-container: '#c08d00'
  on-tertiary-container: '#3e2b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000767'
  on-primary-fixed-variant: '#2f3aa3'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#ffdea3'
  tertiary-fixed-dim: '#f7bd3e'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#121319'
  on-background: '#e4e1eb'
  surface-variant: '#34343b'
typography:
  display:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 1440px
  gutter: 16px
---

## Brand & Style
This design system is engineered for developers and data architects who require high-velocity workflows and maximum information density without cognitive overload. The aesthetic is rooted in **Corporate Minimalism** with a **Technical Edge**, drawing inspiration from the "utility-first" movement seen in high-end devtools.

The personality is precise, authoritative, and sophisticated. It prioritizes clarity of data over decorative elements, utilizing subtle depth, high-contrast typography, and a "dark-first" mentality to create a premium, focus-oriented environment.

## Colors
The palette is optimized for long-duration technical work. The primary color, **Electric Indigo**, acts as the functional anchor for calls to action and active states.

- **Dark Mode (Default):** Uses a deep Obsidian base (`#0a0a0a`) with Charcoal surfaces (`#111111`). Borders are kept lean and low-contrast to prevent visual noise.
- **Light Mode:** Shifts to a Neutral Gray scale (Base: `#ffffff`, Surfaces: `#f9fafb`) with high-contrast text (`#111827`) to maintain readability in bright environments.
- **Semantic Colors:** Success (Emerald), Warning (Amber), and Error (Rose) are used sparingly, primarily for status indicators and data integrity alerts.

## Typography
The system uses a dual-font approach to balance editorial quality with technical precision. 
- **Geist** is reserved for headlines and UI controls to provide a sharp, modern feel.
- **Inter** handles the bulk of data display and body text for its proven legibility at small sizes.
- **JetBrains Mono** is mandatory for all code blocks, SQL editors, and raw data values (UUIDs, timestamps) to ensure character distinction.

## Layout & Spacing
The layout follows a **strict 4px grid system**. This allows for the compact data density required by database administrators while maintaining a clean, organized hierarchy.

- **Grid Model:** A 12-column fluid grid for main dashboards, switching to a sidebar-centric "App Shell" layout for the core management interface.
- **Density:** Information-heavy views (Data Grids) utilize a condensed 8px vertical padding, while marketing or landing pages utilize 16px-24px for breathability.
- **Breakpoints:** 
  - Mobile (<640px): Single column, hidden sidebar (drawer).
  - Tablet (640px - 1024px): 2-column or collapsed sidebar.
  - Desktop (>1024px): Fixed sidebar (240px) with fluid content area.

## Elevation & Depth
This design system avoids heavy drop shadows in favor of **Tonal Layering** and **Micro-borders**.

- **Z-Index Strategy:**
  - Base Layer (`#0a0a0a`): The canvas.
  - Surface Layer (`#111111`): Cards and navigation panels. Highlighting is achieved via a 1px border of `#1f1f23`.
  - Overlay Layer: Modals and dropdowns use a slightly lighter surface with a more pronounced, diffused shadow (0px 8px 24px rgba(0,0,0,0.5)) and a subtle outer glow to separate from the background.
- **Active States:** Active elements use a subtle inner-glow effect or a high-contrast border rather than significant elevation changes.

## Shapes
Shapes are disciplined and geometric. 
- **Standard Radius:** 8px (`rounded-md`) for buttons, inputs, and small cards.
- **Large Radius:** 12px (`rounded-lg`) for main content containers and modals.
- **Interactive Elements:** Use a consistent "soft square" look. Avoid fully circular "pill" shapes except for status tags or avatars to maintain the professional, engineered feel.

## Components
- **Buttons:** Primary buttons use a solid Indigo background with white text. Secondary buttons use a ghost style (transparent background, 1px border). All buttons have a 150ms transition on hover/active states.
- **Data Grids:** The core of the system. Rows feature a subtle hover highlight (`#161618`). Headers are sticky, using `label-md` typography in a muted gray.
- **Input Fields:** Dark-themed inputs with a `#1f1f23` border. On focus, the border transitions to the primary Indigo with a subtle 2px outer glow (ring).
- **Cards:** Defined by a 1px solid border (`#1f1f23`). Title areas are separated by a subtle horizontal divider.
- **Chips/Badges:** Small, low-saturation backgrounds with high-saturation text (e.g., a muted green background with bright green text for "Connected" status).
- **Icons:** Use **Lucide** or **Heroicons** with a 1.5pt stroke weight. Icons should always be visually centered and scaled to 16px or 20px within UI controls.