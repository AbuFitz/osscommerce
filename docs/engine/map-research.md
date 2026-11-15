# Maps: research and decision

Researched 2026-11-15. Sources are linked; everything here was read from the source pages, not recalled.

## What we need
1. **Delivery zones**: show a merchant which areas a zone covers and answer "do I deliver here, and for how much?".
2. **Store / collection-point locator** on merchant storefronts.

## Data licences (the blocker)
| Data | Licence | Usable? |
|---|---|---|
| Postcode **area/district polygons** from Wikipedia KML (`missinglink/uk-postcode-polygons`) | CC BY-SA 3.0, "© Wikipedia contributors" | **No for the product.** Share-alike would pull our derived map data under CC BY-SA. Fine for a private prototype only |
| Royal Mail postcode **boundaries** | Proprietary (PAF licence) | No |
| OS **Boundary-Line** (counties, districts, wards, parishes) | Open Government Licence | **Yes**, with "Contains OS data © Crown copyright and database right [year]". These are administrative areas, not postcode areas, so they do not line up with postcode tokens |
| ONS **postcode directory** (postcode to coordinates and administrative areas) | OGL, with attribution to ONS, OS and **Royal Mail**. Northern Ireland (BT) data needs a separate Land and Property Services licence for commercial use | Yes for Great Britain, with the three attribution lines. BT excluded |
| ONS digital boundaries | OGL + "Source: Office for National Statistics licensed under the Open Government Licence v.3.0" and "Contains OS data © Crown copyright" | Yes |

Sources: [ONS licences](https://www.ons.gov.uk/methodology/geography/licences), [OS Boundary-Line](https://docs.os.uk/os-downloads/products/areas-and-zones-portfolio/boundary-line), [uk-postcode-polygons](https://github.com/missinglink/uk-postcode-polygons).

**Finding:** there is no clean-licence free source of postcode-area polygons. Anything that draws postcode areas as shapes either inherits CC BY-SA or needs a paid Royal Mail / OS licence.

## Tiles and rendering
- **MapLibre GL JS** (BSD) renders; **PMTiles** is a single-file vector basemap format that can be self-hosted on object storage (R2 or S3) with CORS. Protomaps publishes a whole-world OpenStreetMap basemap of roughly 120 GB; regional extracts are made with Planetiler. OpenStreetMap data is ODbL (attribution required). The public OSM tile servers are not for production traffic. Sources: [makewithmaplibre.com/data](https://makewithmaplibre.com/data), [MapLibre PMTiles patterns](https://github.com/maplibre/maplibre-agent-skills/blob/main/skills/maplibre-pmtiles-patterns/SKILL.md). The Protomaps FAQ page was not retrievable, so its hosted-CDN usage terms are **unverified**.
- Self-hosting a UK extract means no third party sees a shopper's map view, which is the privacy-preferred route. Cost: storage and egress, plus a build step.

## Decision
1. **Delivery zones: no polygon map.** Built instead: a postcode coverage checker on Settings → Shipping (`packages/contracts/src/postcode.ts`, tested). It reads the merchant's own zone tokens (`IV`, `PA20–80`, `SW1A`), the most specific match wins, and the postcode never leaves the browser. Limits, stated in the UI copy and code: country names only act as a catch-all, because mapping a postcode to a country needs boundary data.
2. **Drawn zone map: deferred** until we choose between (a) buying a postcode-sector boundary licence, or (b) drawing OS Boundary-Line districts with a postcode-to-district lookup from the ONS directory (GB only, OGL, three attribution lines). Needs a decision on cost and on Northern Ireland.
3. **Store locator: planned** on MapLibre + a self-hosted PMTiles UK extract, with ODbL/OSM attribution shown on the map. Not built. Needs: where the extract is hosted, and a decision on whether shopper geolocation is offered (opt-in only).
