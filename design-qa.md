# Design QA — Tommy Sweets Telegram home

## Evidence

- Source visual truth: `/Users/derf_craft/Downloads/WhatsApp Image 2026-09-21 at 12.28.05.jpeg`
- Source image asset: `/Users/derf_craft/Downloads/WhatsApp Image 2026-09-21 at 12.28.05 (1).jpeg`
- Implemented asset: `images/tommy-walkers-home.jpeg`
- Implementation screenshot: unavailable; final rendering is owned by the Telegram mobile client.
- Source viewport: 916 × 2046 pixels.
- Source asset and implemented asset: 1284 × 1899 pixels, identical source copy.
- State: initial `/start` home message with no verification phrase configured.

## Full-view comparison evidence

The supplied 1284 × 1899 logo image is used directly as the Telegram photo, without cropping, recompression, or an approximation. The caption order matches the reference: store name, divider, payment methods, rating, sales, location, divider, verification phrase, divider, explanatory copy, and Phoenix footer.

## Focused region comparison evidence

- Header: `♦ TOMMY SWEETS`.
- Store facts: `BTC, LTC, XMR`, `5.0/5`, `1967 sales`, and `UK`.
- Verification state: `Verification phrase not set yet` when the session has no phrase.
- Footer: `Made by Phoenix`.
- The unrelated `Linked web account` line was removed to match the supplied reference.

## Findings

- [P1] Live Telegram rendering cannot be captured in this workspace.
  - Location: final photo-and-caption message.
  - Evidence: source screenshots and the exact image asset are available, but there is no authenticated Telegram client capture of the updated bot.
  - Impact: Telegram-specific line wrapping, photo scaling, and client theme rendering cannot be visually certified here.
  - Fix: launch the bot with the intended test token, send `/start`, and capture the resulting message on the target Telegram client.

## Required fidelity surfaces

- Fonts and typography: Telegram-owned; Markdown bold is applied to the store name and a configured verification phrase.
- Spacing and layout rhythm: line order and separators match the reference; exact client wrapping awaits a live capture.
- Colors and visual tokens: Telegram-owned dark theme; the supplied logo preserves the original white field and neon pink/cyan palette.
- Image quality and asset fidelity: exact supplied 1284 × 1899 JPEG copied into the project.
- Copy and content: automated tests cover every reference value and confirm removal of the extra account-link line.

## Comparison history

- Initial state: Apple cover and Apple store name with different stats and an extra linked-account line.
- Fixes made: replaced the cover, store identity, facts, location, divider treatment, and verification block.
- Post-fix evidence: four automated tests pass; exact supplied image dimensions and source copy verified.

## Implementation checklist

- Run the bot against the intended Telegram test account.
- Send `/start` and capture the home state.
- Adjust only if the target client introduces undesirable caption wrapping.

final result: blocked
