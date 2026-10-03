# Diet Coke — 3D Concept Website

An immersive, scroll-driven product website built around a fully procedural 3D Diet Coke can.
Scroll to spin the can through a product tour, crack it open, chill it until it sweats,
then pick a flavor.

![Hero](docs/hero.jpg)

![Chapters](docs/chapters.jpg)

> **Fan-made concept for learning purposes.** Not affiliated with, sponsored or endorsed by
> The Coca-Cola Company. Diet Coke and Coke are registered trademarks of The Coca-Cola Company.

## Highlights

- **A can made entirely in code.** No 3D model and no images: the body, shoulder, rim, domed base,
  pull tab and opening are lathed and extruded geometry, and the printed label is painted onto a
  canvas at runtime, together with a matching roughness/metalness map so the ink sits on real-looking
  brushed aluminium.
- **Studio lighting without HDR files.** A tiny virtual photo studio (softbox strips, rim lights, an
  overhead box) is rendered into a pre-filtered environment map, which gives the can those long
  vertical product-shot highlights.
- **Scroll storytelling.** Each chapter turns a different panel of the label to the camera:
  *zero sugar* → *nutrition facts* → *caffeine*. Then the tab lifts, the can pops open and sprays
  bubbles, condensation beads on the metal and ice cubes drift in.
- **Flavor switcher.** Classic, Cherry, Lime and Mango. The can spins, its artwork is swapped mid-turn
  and the whole page re-themes. Works with buttons, arrow keys or a swipe.
- **Synthesised sound (optional).** Turn on *Sound* in the nav to hear the crack and fizz. It's
  generated live with the Web Audio API, so the project ships no audio files.
- **Details:** preloader, smooth scrolling, masked text reveals, counters, a velocity-reactive marquee,
  magnetic buttons, a custom cursor, film grain and a dedicated mobile layout. With
  `prefers-reduced-motion`, the idle animation and smooth scrolling are turned off.

## Tech stack

| Purpose            | Library                                                     |
| ------------------ | ----------------------------------------------------------- |
| 3D rendering       | [three.js](https://threejs.org)                             |
| Animation & scroll | [GSAP](https://gsap.com) (ScrollTrigger, SplitText)         |
| Smooth scrolling   | [Lenis](https://lenis.darkroom.engineering)                 |
| Build tool         | [Vite](https://vite.dev)                                    |
| Fonts              | Archivo (variable width) & Bodoni Moda, self-hosted via Fontsource |

## Getting started

Requires **Node.js 20.19+ or 22.12+**.

```bash
cd diet-coke-3d
npm install
npm run dev       # http://localhost:5173
```

Production build:

```bash
npm run build     # outputs to dist/
npm run preview   # serves dist/ locally
```

`dist/` is a static site, so you can host it on GitHub Pages, Netlify, Vercel or any static
host. Asset paths are relative (`base: './'`), so it also works from a sub-folder.
Open it through a server (`npm run preview`) rather than double-clicking `index.html`.

## Project structure

```
diet-coke-3d/
├── index.html                  # all page content & sections
├── public/                     # favicon, social preview image
└── src/
    ├── main.js                 # boot sequence: fonts → 3D → loader → intro → scroll
    ├── data/flavors.js         # flavor lineup + page colour themes
    ├── styles/main.css         # design tokens, layout, responsive rules
    ├── webgl/
    │   ├── Experience.js       # renderer, camera, render loop, pointer parallax
    │   ├── Can.js              # can geometry, materials, tab & opening
    │   ├── textures.js         # label artwork, lid, condensation & shadow textures
    │   ├── environment.js      # virtual photo studio → environment map
    │   ├── Bubbles.js          # ambient carbonation + the opening spray
    │   └── IceCubes.js         # glassy ice cubes
    ├── animations/
    │   ├── choreography.js     # the can's poses per chapter, driven by scroll
    │   └── reveal.js           # text reveals, counters, marquee
    └── ui/
        ├── loader.js, cursor.js, flavors.js, sound.js
```

## How the scroll choreography works

`choreography.js` defines a **pose** for every chapter (position, rotation, scale, tab angle,
condensation, ice, bubbles and so on) and a list of scroll segments between them. Instead of
stacking many scrubbed tweens on one object, which breaks when you jump around the page, the
can's pose is **resolved from the scroll position every frame**. Each property follows its own
track of segments, so the result is always correct, whatever the scroll speed or direction and
after any resize.

To tweak the motion, edit the poses in `getStates()`. `x` and `y` are fractions of the half
viewport (`1` = right or top edge), and rotations are in radians.

## Customising

- **Flavors and colours:** `src/data/flavors.js`. The label artwork re-paints itself from these values.
- **Label design:** `drawLabel()` and friends in `src/webgl/textures.js`.
- **Lighting:** the softbox panels in `src/webgl/environment.js`.
- **Copy:** everything lives in `index.html`.
- **Social preview:** `og:image` points to `og-image.jpg` with a relative path. When you deploy,
  change it to the absolute URL so link previews can find it.
