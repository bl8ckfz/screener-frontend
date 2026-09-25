# Coin-Sniffer brand assets

The logo is the **Snout C**: a thick "C" that also reads as a dog's head in
profile. It has a pointed ear, an eye and a snout along the top, and the nose is
bullish green. The gap in the C is the open jaw.

These are the master files. Copy from here into other apps; don't redraw the mark.

## Files

| File | Use |
|---|---|
| `svg/coin-sniffer-mark-on-dark.svg` | Primary mark on dark backgrounds (transparent) |
| `svg/coin-sniffer-mark-on-light.svg` | Mark on white/light backgrounds (darker blue/green for contrast) |
| `svg/coin-sniffer-mark-mono-white.svg` / `-mono-black.svg` | Single colour: watermarks, embossing, one-colour print |
| `svg/coin-sniffer-app-icon.svg` | Rounded-square app icon (`#111827` tile) |
| `svg/coin-sniffer-app-icon-square.svg` | Full-bleed square tile, for platforms that apply their own mask (iOS, Android adaptive) |
| `svg/coin-sniffer-favicon.svg` | App icon with the mark cropped tighter so it survives 16–32 px |
| `png/coin-sniffer-app-icon-{16,32,48,180,192,512,1024}.png` | Raster app icons |
| `png/coin-sniffer-favicon-{16,32}.png` | Raster favicons |
| `png/coin-sniffer-apple-touch-180.png` | `apple-touch-icon` |
| `png/coin-sniffer-mark-*-512.png` | Transparent raster marks |

## Colours

| Token | Hex | Where |
|---|---|---|
| Mark blue | `#2B95FF` | Mark on dark (= Tailwind `accent`) |
| Nose green | `#34d399` | Nose on dark (= Tailwind `bullish.light`) |
| Mark blue, light bg | `#1766d6` | Mark on light |
| Nose green, light bg | `#059669` | Nose on light (= `bullish.dark`) |
| Icon tile | `#111827` | App icon background |

## Rules

- The name is **Coin-Sniffer** (hyphenated). Never "Pulsaryx".
- Keep the nose green. It's the only accent in the mark. In one-colour
  contexts, use the mono files rather than recolouring by hand.
- Leave clear space around the mark of at least the nose's diameter.
- Below 48 px, use the favicon crop, not the app icon.

## In screener-frontend

- `public/favicon.svg`, `public/favicon-32.png` and `public/apple-touch-icon.png`
  are copies of the files above. They're linked from `index.html`.
- `src/components/ui/Logo.tsx` inlines the same geometry (`<Logo />` for the mark
  plus the wordmark, `<LogoMark />` for the mark alone). If the mark ever changes,
  update the SVGs here and that component together.

To regenerate the PNGs after editing an SVG:

```sh
cd brand
for s in 16 32 48 180 192 512 1024; do inkscape svg/coin-sniffer-app-icon.svg -w $s -h $s -o png/coin-sniffer-app-icon-$s.png; done
for s in 16 32; do inkscape svg/coin-sniffer-favicon.svg -w $s -h $s -o png/coin-sniffer-favicon-$s.png; done
inkscape svg/coin-sniffer-app-icon-square.svg -w 180 -h 180 -o png/coin-sniffer-apple-touch-180.png
for v in on-dark on-light mono-white mono-black; do inkscape svg/coin-sniffer-mark-$v.svg -w 512 -h 512 -o png/coin-sniffer-mark-$v-512.png; done
```
