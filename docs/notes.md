# LS Portfolio — Notes & Followups

Running list of small things to come back to. Not a priority/plan doc — just a scratchpad.

## Vehicle images to source better ones for

Vehicles whose auto-sourced images are technically correct but low quality / wrong angle / not a good representative shot. List each as `id | display_name | what's wrong`, and we'll do a targeted re-fetch or manual drop next session.

- _(add entries next session)_

**How to fix when we come back:**
- Ideal source: Rockstar Social Club or the GTA Online in-game photo. Failing that, a better-quality Fandom alternate image.
- Drop replacement into `data/images/vehicles/<id>.webp` (any size; pipeline normalizes to 600-wide webp) then run `npm run images:publish` to sync to `public/vehicles/`.
- For fetch-based replacement: add the vehicle id + correct URL to `FANDOM_URL_OVERRIDES` in `scripts/fetch-missing-images.ts`, bump the image to a suspect state (delete the file or stub it), then `npm run images:fetch-missing`.

## Other followups

- _(add entries as they come up)_
