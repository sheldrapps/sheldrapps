---
name: emil-design-eng
description: Review, critique, and polish frontend motion and animations. Use when the user asks to review UI animations, easing, timing, transitions, micro-interactions, loading motion, drag feedback, repeated loops, or reduced-motion behavior in app components or screens.
---

# Emil Design Eng

## Overview

Use this skill to judge whether motion helps the interface or just adds noise. Focus on timing, easing, interruption, feedback quality, and whether the animation is worth its cost.

## Review Flow

1. Identify every motion surface:
   - enter and exit transitions
   - hover, press, focus, and drag feedback
   - scroll nudges and auto-motion
   - repeated loops, loaders, and skeletons
   - page or panel transitions
2. Check the motion contract:
   - trigger
   - duration
   - easing
   - delay
   - interruptibility
   - reduced-motion fallback
3. Prefer `transform` and `opacity` over layout properties.
4. Treat keyboard-driven and high-frequency actions as sacred. Do not slow them down with ornamental animation.
5. If the interface is already clear without motion, keep the motion minimal.

## Review Format

Respond in a table:

| Before | After | Why |
| --- | --- | --- |
| ... | ... | ... |

If the right answer is to remove motion, say that plainly.

## Motion Rules

- Keep most UI motion under 300ms.
- Use `ease-out` for entry and exit.
- Use `ease-in-out` for in-place movement or back-and-forth motion.
- Use springs only when the motion needs tactility, delight, or interruption.
- Never ship motion without a `prefers-reduced-motion: reduce` fallback.
- Avoid animating layout properties unless the motion is essential to the interaction.
- Use small feedback on press and drag: scale, translate, opacity.
- If motion repeats, it must communicate state, not decorate.
- Avoid auto-playing motion on load unless it solves a real discoverability problem.

## Common Failures

- Motion that fires on load for no good reason
- Repeated nudges, pulses, or glows that steal attention
- Easing that feels floaty, bouncy, or sluggish
- Hover states that are prettier than they are usable
- Drag gestures that fight clicks
- Motion that disappears under reduced motion or headless rendering

## Output

- Be direct and opinionated.
- Call out the highest-risk motion issue first.
- If code changes are obvious, suggest concrete timing, easing, or fallback changes.
- If no animation change is needed, say why.
- After edits, hand off to `validacion` for lint/test/build checks when relevant.
