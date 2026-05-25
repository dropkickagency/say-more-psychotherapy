# Say More Psychotherapy
## Brand Design System & Guidelines

---

*A comprehensive design reference for all visual, written, and experiential touchpoints of the Say More Psychotherapy brand.*

---

## 1. Brand Foundation

### 1.1 Brand Essence

Say More Psychotherapy is a space for honest, unhurried conversation. The brand is built on the belief that healing begins when someone feels safe enough to say one more sentence than they planned to. Every design decision should reinforce that feeling: warm, refined, intimate, and unrushed.

### 1.2 Brand Personality

- **Warm** — never clinical or cold
- **Refined** — considered, elevated, intentional
- **Grounded** — soft but never fragile
- **Feminine** — without being saccharine
- **Quietly confident** — speaks softly, says a lot

### 1.3 Brand Voice

The voice is calm, articulate, and never performative. It uses plain language for hard things and never hides behind jargon. It pauses. It listens on the page.

**Do say:** *"Therapy that meets you where you are."*
**Don't say:** *"Unlock your best self with cutting-edge therapeutic modalities."*

---

## 2. Logo & Wordmark

### 2.1 Primary Wordmark

The wordmark is set in **Canela Light** or **Canela Regular**, lowercase, with generous letter-spacing (`tracking: 40` / `0.04em`). The lowercase setting reinforces the brand's softness and approachability.

```
say more
psychotherapy
```

### 2.2 Clear Space

Maintain a minimum clear space around the wordmark equal to the cap-height of the letter "s" on all sides. Nothing — imagery, text, or graphic elements — should encroach on this zone.

### 2.3 Minimum Size

- **Digital:** 120px wide minimum
- **Print:** 1.25 inches wide minimum

### 2.4 Logo Don'ts

- Don't stretch, skew, or rotate the wordmark
- Don't apply drop shadows, glows, or outlines
- Don't recolor outside the approved palette
- Don't place on busy photography without a tint overlay
- Don't set in all caps — lowercase only

---

## 3. Color Palette

The palette is drawn directly from the office environment: warm walls, the boucle armchair, the blush ottoman, gilded frames, and walnut flooring. Each color carries a role.

### 3.1 Primary Colors

| Name | Hex | RGB | CMYK | Role |
|------|-----|-----|------|------|
| **Warm Cream** | `#EFE6D5` | 239, 230, 213 | 4, 6, 16, 0 | Primary background, base canvas |
| **Walnut Brown** | `#8B5E3C` | 139, 94, 60 | 30, 55, 75, 25 | Primary text, anchors, structure |

### 3.2 Accent Colors

| Name | Hex | RGB | CMYK | Role |
|------|-----|-----|------|------|
| **Blush Pink** | `#E8B8B0` | 232, 184, 176 | 5, 30, 25, 0 | Soft accent, call-to-actions, highlights |
| **Antique Gold** | `#C9A961` | 201, 169, 97 | 22, 32, 70, 5 | Premium detail, dividers, icon strokes |

### 3.3 Extended Neutrals

For body copy, secondary surfaces, and UI states, the palette extends with these supporting tones:

| Name | Hex | Use |
|------|-----|-----|
| Ivory | `#F8F2E6` | Lightest surface, card backgrounds |
| Sand | `#D9CDB4` | Section dividers, secondary surfaces |
| Cocoa | `#5A3D27` | Body copy on cream |
| Espresso | `#3A2515` | Headlines on cream, highest contrast |

### 3.4 Color Pairings

**Approved combinations:**
- Walnut Brown text on Warm Cream background (primary)
- Espresso text on Ivory background (long-form reading)
- Warm Cream text on Walnut Brown background (inverted)
- Blush Pink button with Cocoa text (CTA)
- Antique Gold underline beneath Walnut Brown headings (editorial)

**Avoid:**
- Blush Pink on Warm Cream (insufficient contrast)
- Antique Gold on Sand (insufficient contrast)
- Pure black or pure white anywhere in the system

### 3.5 Accessibility

All text-on-background combinations must meet **WCAG AA** minimum (4.5:1 for body, 3:1 for large text). Run contrast checks on every new pairing before approving for use.

---

## 4. Typography

### 4.1 Typeface: Canela

Canela by Commercial Type is the sole typeface across the brand. It is a contemporary serif with subtle flares — warm, literary, and quietly confident. It speaks the way the brand wants to be heard.

**Required weights:**
- Canela Thin
- Canela Light
- Canela Regular
- Canela Medium
- Canela Bold (sparingly)

**Required styles:**
- Canela Italic (for emphasis and editorial moments)

### 4.2 Type Scale

| Level | Weight | Size (Desktop) | Size (Mobile) | Line Height | Tracking |
|-------|--------|----------------|---------------|-------------|----------|
| Display | Light | 72px | 44px | 1.05 | -0.02em |
| H1 | Light | 56px | 36px | 1.1 | -0.015em |
| H2 | Regular | 40px | 28px | 1.15 | -0.01em |
| H3 | Regular | 28px | 22px | 1.25 | -0.005em |
| H4 | Medium | 20px | 18px | 1.3 | 0 |
| Body Large | Regular | 19px | 17px | 1.65 | 0 |
| Body | Regular | 17px | 16px | 1.7 | 0 |
| Caption | Regular | 14px | 13px | 1.5 | 0.01em |
| Eyebrow | Medium | 12px | 11px | 1.4 | 0.15em (uppercase) |

### 4.3 Typographic Principles

- **Set body copy at a reading-friendly width:** 60–75 characters per line
- **Use italics, not bold, for emphasis** within prose — bold breaks the literary tone
- **Lowercase preferred** for headlines and navigation; reserve title case for proper nouns
- **Generous line-height** (1.65–1.7) makes long-form content feel breathable
- **No more than two type sizes per visual moment** — restraint reinforces calm

### 4.4 Fallback Stack

When Canela is unavailable (email, system contexts), use this fallback:

```css
font-family: 'Canela', 'Cormorant Garamond', 'Playfair Display', 'Georgia', serif;
```

---

## 5. Imagery & Photography

### 5.1 Photographic Style

Photography should feel like the office itself: natural light, warm tones, soft focus where appropriate, and quiet detail. Avoid stock-photo affectations.

**Do shoot:**
- Interior textures: boucle, velvet, brass, wood grain
- Hands holding tea, journals, soft objects
- Empty chairs (the invitation)
- Window light, morning or late afternoon
- Out-of-focus florals and foliage

**Don't shoot:**
- Therapist with arms crossed
- Stock "concerned" expressions
- Clipboards, glasses-being-removed, brain illustrations
- Cold blue tones, fluorescent lighting
- Faces of clients (ethical and emotional reasons)

### 5.2 Color Treatment

Apply a subtle warm grade to all photography:
- Lift shadows slightly (avoid pure black)
- Pull highlights toward cream rather than white
- Desaturate cool tones (blues, greens) by 10–15%
- Boost warm tones (oranges, pinks) by 5–10%

### 5.3 Illustration

When illustration is used, it should be:
- Hand-drawn or hand-drawn-feeling
- Single-color, in Walnut Brown or Antique Gold
- Botanical, abstract, or architectural — never figurative

---

## 6. Layout & Composition

### 6.1 Grid

- **Desktop:** 12-column grid, 80px margins, 32px gutters
- **Tablet:** 8-column grid, 48px margins, 24px gutters
- **Mobile:** 4-column grid, 24px margins, 16px gutters

### 6.2 Spacing Scale

A consistent 8px base unit governs all spacing:

```
xs   = 8px
sm   = 16px
md   = 24px
lg   = 40px
xl   = 64px
2xl  = 96px
3xl  = 128px
```

Use generously. White space is part of the brand — it gives the reader room to breathe.

### 6.3 Composition Principles

- **Asymmetry over symmetry** — slightly off-center compositions feel more human
- **One focal point per view** — never compete for attention
- **Anchor with type, breathe with space** — let headlines lead, let air follow
- **Hairline dividers in Antique Gold** — 0.5px or 1px maximum

### 6.4 Corner Radii

- **Buttons & inputs:** 4px (subtle, refined)
- **Cards:** 8px
- **Image containers:** 12px (or none — sharp edges work)
- **Avoid pill shapes** unless used intentionally for tags

---

## 7. UI Components

### 7.1 Buttons

**Primary button**
- Background: Walnut Brown `#8B5E3C`
- Text: Warm Cream `#EFE6D5`, Canela Medium 16px
- Padding: 16px 32px
- Border radius: 4px
- Hover: darken background 8%

**Secondary button**
- Background: transparent
- Border: 1px Walnut Brown
- Text: Walnut Brown, Canela Medium 16px
- Hover: fill with Blush Pink at 20% opacity

**Tertiary / text link**
- Text: Walnut Brown, underlined
- Hover: color shifts to Antique Gold

### 7.2 Forms

- Input height: 48px minimum
- Border: 1px Sand `#D9CDB4`
- Border on focus: 1px Walnut Brown
- Label: Eyebrow style, Walnut Brown, 8px below
- Placeholder: Cocoa at 50% opacity

### 7.3 Cards

- Background: Ivory `#F8F2E6`
- Border: none (or 0.5px Sand)
- Padding: 32px
- Shadow: none (the brand avoids shadows for a flat, considered feel)

---

## 8. Voice & Copywriting

### 8.1 Tone Principles

- **Speak in second person** — "you," not "clients"
- **Use contractions** — "you're," not "you are"
- **Short sentences for hard truths.** Longer ones for ideas that need to unfold.
- **No exclamation points** — the brand doesn't shout
- **No emoji** in written brand copy
- **Never use the word "journey"** — overused in the wellness category

### 8.2 Sample Microcopy

| Context | Copy |
|---------|------|
| Hero headline | *Therapy that meets you where you are.* |
| Subhead | A quiet space to say what hasn't been said. |
| Booking CTA | Book a consultation |
| Form intro | Tell us a little about what brings you here. |
| Form submit | Send |
| Confirmation | Thank you. We'll be in touch within two business days. |
| Footer line | Say More Psychotherapy · Established with care |

### 8.3 Words to Use

*considered, gentle, honest, unhurried, present, grounded, warmth, attention, listening, space, quiet, room to breathe*

### 8.4 Words to Avoid

*journey, unlock, empower, transform, leverage, optimize, holistic (overused), authentic (overused), curated, bespoke*

---

## 9. Digital Applications

### 9.1 Website

- Backgrounds default to Warm Cream
- Hero sections use generous vertical padding (160px+ desktop)
- Page transitions: soft fade, 400ms ease-out
- Cursor: default (don't customize)
- Scroll behavior: smooth

### 9.2 Email

- Header: wordmark centered on Warm Cream
- Body width: 600px maximum
- Body text: 17px Canela Regular, line-height 1.7
- Buttons follow primary button spec
- Footer: Eyebrow-style legal copy in Cocoa

### 9.3 Social Media (Instagram-first)

- Use Warm Cream or Ivory as primary background
- One quote per post, generously spaced
- Type at 60–70% of the canvas width
- Use Antique Gold sparingly as an accent line or detail
- Never stack more than three colors in one post

---

## 10. Print Applications

### 10.1 Business Cards

- Stock: uncoated, warm white, 350gsm minimum
- Dimensions: 85 × 55mm (European) or 3.5 × 2" (North American)
- Front: wordmark centered, Walnut Brown ink on Warm Cream stock
- Back: contact details, Canela Regular 9pt, Walnut Brown
- Optional finishing: blind deboss on wordmark (no foil — foil feels too commercial)

### 10.2 Stationery

- Letterhead: wordmark top-left, Walnut Brown
- Antique Gold hairline rule above footer
- 1-inch margins all sides
- Body in Canela Regular 11pt

### 10.3 Signage

- Interior: wordmark in brushed brass or matte walnut acrylic
- Mounted with 0.5-inch standoff for soft shadow
- Reception area: framed mission statement in Canela Light, mat board in Warm Cream

---

## 11. Brand in Practice — Quick Reference

### 11.1 The 60-30-10 Rule

In any composition:
- **60%** Warm Cream (or Ivory)
- **30%** Walnut Brown (text and structural elements)
- **10%** Blush Pink + Antique Gold combined (accents only)

### 11.2 Five-Second Test

Before publishing any piece of brand material, ask:

1. Does it feel calm?
2. Could I read it in a quiet room without flinching?
3. Is there enough space around the type?
4. Is anything trying too hard?
5. Would a client in distress feel welcomed by this?

If any answer is "no," revise.

---

## 12. File Organization & Handoff

### 12.1 Asset Directory Structure

```
/brand
  /logo
    wordmark-walnut.svg
    wordmark-cream.svg
    wordmark-gold.svg
  /color
    palette.ase
    palette.sketchpalette
  /type
    Canela-Thin.otf
    Canela-Light.otf
    Canela-Regular.otf
    Canela-Medium.otf
    Canela-Bold.otf
    Canela-Italic.otf
  /photography
    /approved
    /raw
  /templates
    business-card.indd
    letterhead.indd
    social-square.psd
    social-story.psd
```

### 12.2 Version Control

Update this document with every brand revision. Each change should include:
- Date
- Author
- Section affected
- Reason for change

---

## Appendix A — Color Tokens (Design System)

```css
:root {
  /* Primary */
  --color-cream:        #EFE6D5;
  --color-walnut:       #8B5E3C;

  /* Accent */
  --color-blush:        #E8B8B0;
  --color-gold:         #C9A961;

  /* Extended */
  --color-ivory:        #F8F2E6;
  --color-sand:         #D9CDB4;
  --color-cocoa:        #5A3D27;
  --color-espresso:     #3A2515;

  /* Typography */
  --font-display: 'Canela', 'Cormorant Garamond', Georgia, serif;
  --font-body:    'Canela', 'Cormorant Garamond', Georgia, serif;

  /* Spacing */
  --space-xs:  8px;
  --space-sm:  16px;
  --space-md:  24px;
  --space-lg:  40px;
  --space-xl:  64px;
  --space-2xl: 96px;
  --space-3xl: 128px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

*Document version 1.0 — Say More Psychotherapy Brand Design System*
*This is a living document. Treat it with the same care the brand asks of every interaction.*
