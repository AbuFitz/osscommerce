# Portal interaction principles

The visual language started from reference imagery. This document is the part that is ours: how the portal behaves. Every control is held to it, and `apps/portal/scripts/interactions.cjs` checks the behaviour in a real browser on desktop and phone sizes.

## Rules
1. **Every control does something you can see.** No decorative buttons. If a feature is not built, the control is not shown. If it is blocked, it opens an explanation of what is blocking it (see Request launch), not nothing.
2. **The result is real and visible.** A successful action changes what the pages show (the demo keeps a per-browser copy of its data for this reason) and the toast says what changed ("Order #1042 marked fulfilled. Maya has been emailed"), never just "Saved".
3. **One dialog pattern** (`FormDialog`): opens from a labelled button; validates on submit and names the exact field and problem; focus moves to the first error; Enter submits; the primary button shows progress and cannot be pressed twice; Esc, the close button and a click outside cancel without saving; on small screens it is a bottom sheet. Disabled-until-valid buttons are not used, because they hide the reason.
4. **Say no clearly.** Business rules refuse with a reason and a way forward (duplicate SKU, stock below reserved, refund above what is left, order emails cannot be turned off).
5. **Preview before commit for bulk actions.** CSV import parses in the browser, shows how many rows are good and names each bad line before anything is added.
6. **Destructive or outward-facing actions confirm**, in plain language, what will happen and who is told.
7. **Exports are safe.** CSV cells that begin with `=`, `+`, `-` or `@` are neutralised so a customer's name cannot run as a spreadsheet formula.
8. **Phones get composition, not shrinkage.** Settings are grouped lists; headers put actions under the title; long list pages use two-line rows; tabbed panes replace stacked panels (Emails).
9. **Motion explains, never decorates.** Dialogs scale in from where they were opened (sheets slide up on phones), arrivals fade and settle, buttons press. All of it is disabled under `prefers-reduced-motion`. Tokens: `--ease`, `--dur-1/2/3`.
10. **Forms use one id per instance.** Repeated dialogs get unique ids (a duplicate-id bug in the zone dialog broke label association until the interaction test caught it).

## What is clickable and what happens
| Control | Result |
|---|---|
| Add product | Dialog, validates, product appears in Products, Inventory and Overview counts; duplicate SKU refused |
| Import CSV | Parse and preview in the dialog; import good rows; skipped rows named with line numbers |
| Adjust stock | Dialog with reason; refuses below zero or below reserved; logged |
| Create discount | Dialog with type-dependent fields; code upper-cased; duplicates refused |
| Export (customers) | Downloads a CSV including marketing consent |
| Add / Edit zone | Dialog with repeatable delivery options and per-field errors |
| Check domain | Shows the DNS record to add, then verifies |
| Request launch | Lists exactly what blocks it, or sends the request when ready |
| Request design change | Creates a quote request that appears under Support |
| Mark fulfilled / Refund | Order changes state; refund names the fee returned and any restock |
| Invite member / Approve access | Member appears as invited; grant becomes active with expiry |
| Add photos from your phone | QR dialog; photos arrive live (ADR 0007) |

## Known gaps
Payments and automation wording are still in places the demo only; the live gateway will return the same shapes. There is no undo for fulfil or refund yet; both confirm first. Keyboard-only and screen-reader passes were done through the accessibility tree and focus order in the tests, not with assistive technology.
