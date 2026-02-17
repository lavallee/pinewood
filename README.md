# Pinewood Derby Race Engineering Lab

A 3D design and optimization tool for pinewood derby cars. Visualize your car, dial in weight placement, check center of gravity, and validate against competition rules — all in the browser.

![Pinewood Derby Lab](screenshot-overview.png)

## What This Does

This is a single-page web app that helps you design and optimize a pinewood derby car before you cut any wood. It includes:

- **3D visualization** of your car with X-Ray, Cutaway, and Drilled views
- **Body shaping** — adjust nose height, scoop depth, rear profile, and more
- **Weight management** — place tungsten rods, cubes, putty, lead, steel BBs, or custom weights and see exactly where your center of gravity lands
- **Axle engineering** — set bend angles, camber, raised wheels, and choose between slot and drilled mounting
- **Rules compliance checker** — real-time validation against weight limits, dimensions, and CoG targets
- **Auto-optimizer** — suggests weight placement to hit your target weight and CoG
- **Design library** — save, load, and share car configurations as JSON
- **3D print planning** — specs for printing jigs, gauges, and templates

Ten example designs are included to get you started.

## Getting Started

No build step. Just open `index.html` in a browser, or deploy the folder to any static host.

```
open index.html
```

Or deploy to Vercel, Netlify, GitHub Pages — whatever you like. It's a single HTML file with no dependencies beyond CDN-hosted Three.js.

## This Is Vibecoded

This entire project was built with AI assistance. The code lives in one big HTML file. There's no framework, no build system, no component library — just HTML, CSS, JavaScript, and Three.js.

**Fork it. Remix it. Make it yours.**

Some ideas:
- Add your own pack's rules and weight limits
- Change the color scheme or UI layout
- Add new weight types or materials
- Build an export-to-STL feature for CNC or 3D printing the car body
- Add race simulation or speed estimation
- Integrate with a sensor for real weigh-ins
- Support different car specs (like Awana Grand Prix or other derby formats)

The code is intentionally all in one file to make it easy to understand, modify, and deploy. You don't need to be a professional developer to hack on this — that's the point.

## Tech Stack

- Vanilla JavaScript (no framework)
- [Three.js](https://threejs.org/) r128 for 3D rendering
- CSS3 with custom properties
- Browser localStorage for saving designs
- Zero build tools required

## License

[MIT](LICENSE) — do whatever you want with it.
