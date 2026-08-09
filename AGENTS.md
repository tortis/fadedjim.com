## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Note: `pnpm run`/`pnpm build` may fail on a supply-chain "minimum release age" check for freshly published packages. Invoke the local binary directly instead: `./node_modules/.bin/astro build`.

## Project structure

Single-page brand site for a barber. `src/pages/index.astro` composes section components from `src/components/` (Nav, Hero, Gallery, About, Reviews, Hours, Footer).

- Site-wide values (booking URL, Instagram handle/URL) live in `src/data/site.json`; `src/site.ts` re-exports them (plus name/tagline) so Book Now buttons keep pulling from `site`.
- Design tokens (colors/fonts from the bg.jpg brand graphic) and custom utilities (`.btn`, `.reveal`, `.polaroid`, `.grain`, starfield) live in `src/styles/global.css` (Tailwind v4 `@theme`).
- `public/bg.jpg` is the original brand graphic; `public/bg-no-text.png` is a textless variant; `public/sky.jpg` is the web-optimized JPEG derived from it (used as the hero + footer backdrop). Display type is `public/HorndonD.ttf` (loaded via `@font-face` in global.css).
- Cut photos and Jim's portrait live in `src/data/images/` (`cut-1.jpg`…`cut-4.jpg`, `jim.jpg`) and are loaded via `import.meta.glob` so filenames — not imports — decide which image renders. Rendered via `astro:assets` `<Image>` (auto WebP srcset at build time; sharp is in devDependencies).

## Content

All Jim-editable content lives in **`src/data/data.json`**, imported directly by components. Components should always read from here, never hardcode copy.

- `links` — booking URL, Instagram handle/URL (re-exported by `src/site.ts` so Book Now buttons keep pulling from `site`)
- `copy` — key/value strings (hero subtitle, about paragraphs, hours note, footer line)
- `hours` — `[{ days, time }]` rows for the Hours section
- `reviews` — `[{ quote, name }]`; rotation classes are assigned by array index in `Reviews.astro`
- `cuts` — `[{ image, alt }]` where `image` is a filename in `src/data/images/`; `Gallery.astro` resolves it through the glob. Rotation classes also by index.
- `images/` — photos referenced by `cuts` plus `jim.jpg`

## Admin

`src/pages/admin.astro` (`/admin`, noindexed, not linked) is a static form pre-filled from `data.json`. It supports add/remove rows for hours/reviews/cuts and resizes selected photos client-side (canvas, max 1600px JPEG q85). Save & Publish POSTs multipart form data (password, JSON payload, image files) to the publish endpoint. New uploads get unique timestamped filenames (`cut-<ts>-<n>.jpg`) so they never collide with existing files; after a successful publish the form marks them as committed so re-saving doesn't re-upload.

### Publish endpoint

`functions/api/publish.ts` is a Cloudflare Pages Function (deployed automatically with the static `dist/` output; no Astro adapter needed). It checks a shared password, validates the payload, and commits `src/data/data.json` + any uploaded images to `tortis/fadedjim.com@main` in one atomic commit via the GitHub Git Data API (blobs → tree → commit → ref update), pruning unreferenced `cut-*` images. The push triggers the Cloudflare Pages rebuild.

Required env vars (set in the Cloudflare Pages project settings for Production):

- `GITHUB_TOKEN` — fine-grained PAT scoped to the repo, Contents: read/write
- `ADMIN_PASSWORD` — shared secret Jim types into the form

Local testing: `./node_modules/.bin/astro build`, then `wrangler pages dev dist --compatibility-date 2026-08-08` with secrets in `.dev.vars` (gitignored). The plain `astro dev` server does not serve the function. Type-check the function with `tsc -p functions/tsconfig.json`.

## Screenshots

`node scripts/screenshots.mjs` captures every section at mobile + desktop widths to `/tmp/opencode/` using system chromium via puppeteer-core (requires the dev server running).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
