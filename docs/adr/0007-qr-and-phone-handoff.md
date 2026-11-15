# ADR 0007: QR codes and "continue on your phone"

Status: photo handoff built (demo storage); QR sign-in deliberately not built

## What we considered
| Idea | Verdict | Why |
|---|---|---|
| **Add photos from your phone** (desktop shows a QR code, phone camera or library sends photos straight into the product, like Marketplace) | **Built** | Product photos live on the merchant's phone. Moving them to a computer first is the most common point where a sole trader gives up. The phone link needs no login, so it works with a stranger-proof capability instead of an account. |
| **Preview your storefront on your phone** (QR to the preview URL) | Not yet | Cheap and useful, but it needs real storefront preview URLs from the registry (ADR 0004). Add when previews exist. |
| **QR sign-in** (desktop shows a code, phone approves the login, like WhatsApp Web) | **Not built** | See below. |
| Phone as a barcode scanner for stock and GTINs | Later | Real value for inventory, but needs the product editor and GS1 work first. |

## Why not QR sign-in
A login QR code is a known phishing vector ("quishing"): an attacker starts a login on their own computer, shows the victim the code, and the victim's phone approves the attacker's session. Safe versions need number matching, device and location prompts, short expiry and a trusted-device list, on top of an auth system we do not have yet. The better answer is **passkeys (WebAuthn)**: they already include a QR-based cross-device flow, are phishing-resistant by design, and need no code of ours to show a QR. Recommendation: build passkeys with the real portal login, not a custom QR login.

## Photo handoff design (`packages/handoff`)
- The phone link is a **capability, not a login**: `id.secret` (72 + 256 bits), the secret stored only as a SHA-256 hash. It can only add images to one named product, from **one phone** (the first device to open it is bound by an HttpOnly cookie; a forwarded or photographed code is refused), for **10 minutes**, up to 12 photos. It cannot read anything.
- Only the person who created the link, in the same store, can see its status or close it. Support roles cannot create one. A user can have 3 open links.
- **Photos are checked by content, not by name or declared type** (JPEG, PNG, WebP), size-limited to 12 MB, de-duplicated by hash, and **stripped of metadata** (EXIF/GPS, XMP, comments, PNG text chunks) before storage. Sole traders often photograph at home, so location data in a product image is a real privacy leak. The phone also shrinks and re-encodes large photos in the browser (2400px, JPEG) which saves mobile data and drops metadata a second time.
- The desktop sees photos arrive live (polling, paused when the tab is hidden), and the QR collapses once the phone has connected.
- Verified in a real browser: desktop and two separate phone contexts, live arrival, duplicate ignored, second phone refused, stored copies contain no GPS bytes, the link is dead after Done.

## Limits and what is still demo
- Storage is in-process memory in the demo. The live platform needs an object-storage `PhotoStore` (R2) and the real session in place of the fixed demo caller. `AVAILABLE` is tied to demo mode so the live portal does not offer it until then.
- A phone must be able to reach the portal URL. On localhost the dialog says so and offers the link instead.
- No malware scanning, image-size (pixel) limits, or CDN transforms yet.
