# RollWithIt

Browser-based custom roller generator for the [MakerSpace Business Card Embosser 3D Model on MakerWorld](https://makerworld.com/en/models/148536-business-card-embosser-level-up-your-cards).

RollWithIt allows you to design custom patterns, repeating text, or upload artwork to generate 3D printable male and female embossing rollers. The generated rollers snap directly into the physical 3D printed embosser mechanism — no CAD software required!

## What it does

This app produces matched **male** and **female** rollers tailored for hand-cranked business card embossers:
- **Male Roller**: Features raised relief geometry corresponding to your artwork or pattern.
- **Female Roller**: Features matching recessed geometry with built-in clearance so paper cardstock is cleanly pressed between them without tearing.
- **Direct Compatibility**: Pre-configured with the default dimensions (Ø30 mm × 60 mm, 12.2 mm square drive) required by the [MakerSpace embosser 3D model](https://makerworld.com/en/models/148536-business-card-embosser-level-up-your-cards).

## Features

- **Pattern Presets**: Polkadot, ZigZag, Confetti, Waves, Diamonds, Chevrons, Hearts, and Text
- **Image Relief Upload**: Upload logos, monograms, or vector graphics; auto-thresholded into crisp emboss relief
- **Smart Filenames**: Export filenames automatically match your uploaded artwork title
- **Freehand Painting & Erasing**: Draw directly on the unwrapped roller surface
- **Live 3D Preview**: Interactive Three.js preview showing male & female rollers in real-time
- **STL ZIP Download**: High-resolution binary STLs for both male and female rollers pre-oriented for your 3D slicer (Bambu Studio, OrcaSlicer, PrusaSlicer)
- **SVG Export**: Download vector files of the unwrapped pattern

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL in your browser.

## Build for deployment

```bash
npm run build
```

Deploy the `dist/` folder to GitHub Pages or any static host.

## Print tips

- Print rollers in **PLA** with 0.16–0.20 mm layer height; no supports needed when printed vertically or on their side.
- Dry-fit gears on the square drives before first use.
- Always test embossing on scrap card stock.

## License & attribution

RollWithIt is an independent fan tool and generator — not affiliated with MakerSpace.Online. The physical embosser model is licensed by its original author on MakerWorld (CC BY-NC-SA).
