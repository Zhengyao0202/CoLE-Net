# Three-dimensional motivation film

A 44-second CoLE-Net film built with Three.js places clinical label generation beside local MRI evidence modeling, highlights their correspondence, and concludes with recorded-site validation.

```bash
cd animation
npm install
npx playwright install chromium
npm run preview
```

Open the printed local URL. The scene uses a fixed timeline and loops during preview.

```bash
npm run stills
npm run render
```

Rendering requires FFmpeg on `PATH`. Outputs are written to `animation/output/`: a 1600 × 900, 24 fps H.264 MP4, eleven storyboard frames, a poster, and a render manifest. Set `CHROME_PATH` to use an existing Chromium or Chrome executable. `--width`, `--fps`, and `--out-dir` override the defaults, for example `npm run render -- --width 1280 --fps 24`.

The anatomy is a conceptual illustration; the closing validation panel contains recorded study evidence. Anatomical assets retain their CC BY licenses. See [NOTICE.md](NOTICE.md) for credits and [assets/CREDITS.json](assets/CREDITS.json) for pinned sources and hashes. The scene and renderer use the repository's MIT license.

GitHub Pages serves the exported film from `docs/`; it needs no Node.js runtime. To use a revised render, copy its MP4 and poster into `docs/assets/` and regenerate the GIF and captions for the new timeline.
