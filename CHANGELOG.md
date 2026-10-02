# Changelog

## 0.3.4
- Stop replacing the Forbidden Lands character header. Native FBL and Quick Access header controls, Reputation, Willpower helpers and fields now remain authoritative.
- Move Mortar-only Awakening and active-passive readouts into the compact SYSTEM STATUS block on MAIN.
- Register Quick Access integration during Foundry `init` instead of waiting for `ready`, with the existing API-ready fallback for uncertain module hook order.
- Reattach Quick Access Talent/Spell tooltips to the custom AUXILIARY ROUTINES rows through the new public `setupTalentItemTooltips(actor, root)` API when available.
- Add a scoped Quick Access compatibility layer so Gear cards, wallet elements, BIO, STAT and in-sheet Reputation presentation inherit the selected Mortar palette.
- Leave Rest/Reboot interception and New Day/Critical Injury behavior unchanged.
- Serialize protocol progression per Actor, lock upgrade controls while an operation is open, and revalidate EXP/rank prerequisites after dialogs before committing.
- Add compensation for failed protocol rank/item writes so EXP and Recovery attribute changes are restored when progression cannot complete.
- Harden stored Mortar-state normalization against malformed `structuralDamage` or `psychosis` flags.

## 0.3.3
- Audited the module against the exact Forbidden Lands v13.0.5 character-sheet templates, CSS, ActorSheet, Actor document, Talent sheet, and roll handler.
- Made the compact Mortar header fit the system's native 660px character sheet without hard minimum widths.
- Restored Reputation rolling and General Talent create/edit/post/delete controls that were lost when replacing native sheet sections.
- Preserve the PROTOCOLS/SERVICE subtab across actor-sheet rerenders.
- Respect Foundry/FBL limited actor views and sheet editability.
- Hide the empty native biological Conditions heading/grid while keeping Food and Water visible in Gear.
- Fixed native FBL odd-row and Gear-header colors for dark/light Mortar themes.
- Apply the selected Mortar theme to Quick Access and suppress Mortar details for limited viewers.
- Require the Mechanical Body talent as the sole Mortar detection marker.
- Keep Mortar mode synchronized when Mechanical Body is renamed, created, or deleted, and clear stale biological condition effects on startup.
- Handle cancelled FBL repair-roll dialogs without an unhandled rejection.
- Fix innate chassis armor so it remains part of native FBL armor rolls when equipped armor Item IDs are included in the roll identifiers.
- Replace remaining native parchment panel borders with theme-aware terminal lines and compact the stock FBL tab bar.

## 0.3.2
- Compacted the Mortar header to preserve sheet height and reduce empty space.
- Removed the redundant UNIT field.
- Added portrait changing directly from the compact header.
- Kept food and water visible in inventory for Mortars.

## 0.3.0
- Detect Mortar actors by the talent "Механическое Тело" / "Mechanical Body".
- Rebuilt the entire Mortar header.
- Added three light themes and a Custom Palette theme with configurable colors.
- Styled Mortar dialogs and inactive passives.
- Improved sheet theming consistency, row striping and viewport clamping.
