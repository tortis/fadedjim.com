## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Note: `pnpm run`/`pnpm build` may fail on a supply-chain "minimum release age" check for freshly published packages. Invoke the local binary directly instead: `./node_modules/.bin/astro build`.

## Project structure

Single-page brand site for a barber. `src/pages/index.astro` composes section components from `src/components/` (Nav, Hero, Gallery, About, Reviews, Hours, Footer).

- Site-wide values (booking URL, Instagram handle) live in `src/site.ts` — Book Now buttons pull from there.
- Design tokens (colors/fonts from the bg.jpg brand graphic) and custom utilities (`.btn`, `.reveal`, `.polaroid`, `.grain`, starfield) live in `src/styles/global.css` (Tailwind v4 `@theme`).
- `public/bg.jpg` is the original brand graphic; `public/bg-no-text.png` is a textless variant; `public/sky.jpg` is the web-optimized JPEG derived from it (used as the hero + footer backdrop). Display type is `public/HorndonD.ttf` (loaded via `@font-face` in global.css).
- Cut photos and Jim's portrait live in `src/assets/` and are rendered via `astro:assets` `<Image>` (auto WebP srcset at build time; sharp is in devDependencies). Add new photos by dropping them there and importing them in the component.

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
