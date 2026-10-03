import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BASE_STATE } from '../webgl/Experience.js';

gsap.registerPlugin(ScrollTrigger);

const TAU = Math.PI * 2;
export const MOBILE_QUERY = '(max-width: 768px)';

// Key poses of the can for every chapter of the page. Each chapter rotates
// a different panel of the label towards the camera:
//   ry = 0      front (logo)        ry = TAU/4   "zero sugar" side
//   ry = TAU/2  nutrition facts     ry = 3TAU/4  caffeine & flavor side
export function getStates(mobile = window.matchMedia(MOBILE_QUERY).matches) {
  const B = BASE_STATE;
  const S = {};
  if (!mobile) {
    S.hero = { ...B, y: 0.02, rx: 0.06, rz: -0.12, spin: 1, float: 1, bubbles: 1 };
    S.sugar = { ...B, x: 0.42, y: -0.02, scale: 1.04, rx: 0.03, ry: TAU * 0.25, rz: 0.05, float: 0.5, shadow: 0.5, bubbles: 0.2 };
    S.crack = { ...B, y: -0.14, scale: 1.24, rx: 0.68, ry: TAU, float: 0.3, bubbles: 0.4 };
    S.cold = { ...B, x: -0.4, y: -0.02, rx: 0.04, ry: TAU + 0.2, rz: 0.06, tab: 0.12, mouth: 1, burst: 1, float: 0.6, shadow: 0.45, bubbles: 0.3 };
    S.flavors = { ...B, y: 0.03, scale: 0.96, rx: 0.05, ry: TAU, rz: -0.05, float: 1, sway: 1, shadow: 0.4, bubbles: 0.6 };
    S.footer = { ...B, y: 0.2, scale: 0.8, rx: 0.06, ry: TAU, rz: -0.1, spin: 1, float: 1, bubbles: 0.7 };
  } else {
    // Portrait: the can lives in the top half, copy sits underneath.
    S.hero = { ...B, y: 0.16, scale: 0.82, rx: 0.06, rz: -0.12, spin: 1, float: 1, bubbles: 1 };
    S.sugar = { ...B, y: 0.4, scale: 0.78, rx: 0.03, ry: TAU * 0.25, rz: 0.05, float: 0.5, shadow: 0.5, bubbles: 0.2 };
    S.crack = { ...B, y: 0.12, scale: 0.92, rx: 0.68, ry: TAU, float: 0.3, bubbles: 0.4 };
    S.cold = { ...B, y: 0.42, scale: 0.7, rx: 0.04, ry: TAU + 0.2, rz: 0.06, tab: 0.12, mouth: 1, burst: 1, float: 0.6, shadow: 0.45, bubbles: 0.3 };
    S.flavors = { ...B, y: 0.2, scale: 0.72, rx: 0.05, ry: TAU, rz: -0.05, float: 1, sway: 1, shadow: 0.4, bubbles: 0.6 };
    S.footer = { ...B, y: 0.1, scale: 0.55, rx: 0.06, ry: TAU, rz: -0.1, spin: 1, float: 1, bubbles: 0.7 };
  }
  // Once sprayed, the burst stays finished; animating it back to 0 would
  // replay the spray in reverse on the way to the flavors.
  S.flavors.burst = 1;
  S.footer.burst = 1;
  S.calories = { ...S.sugar, ry: TAU * 0.5 };
  S.caffeine = { ...S.sugar, ry: TAU * 0.75 };
  S.cracked = { ...S.crack, tab: 1, mouth: 1 };
  S.sprayed = { ...S.crack, tab: 0.12, mouth: 1, burst: 1, rx: 0.5, scale: S.crack.scale * 0.96, bubbles: 0.9 };
  S.frozen = { ...S.cold, ry: TAU + 0.8, frost: 1, ice: 1 };
  S.exit = { ...S.flavors, y: 1.9, ry: TAU + 1.2, rz: 0.35, sway: 0, shadow: 0, bubbles: 0 };
  S.below = { ...S.exit, y: -1.9 }; // waits under the fold for the finale
  return S;
}

const pick = (state, keys) => Object.fromEntries(keys.map((k) => [k, state[k]]));

// A slice of a ScrollTrigger's range, read live so it survives refreshes.
const slice = (trigger, from = 0, to = 1) => ({
  get start() {
    return trigger.start + (trigger.end - trigger.start) * from;
  },
  get end() {
    return trigger.start + (trigger.end - trigger.start) * to;
  },
});

// The can's pose is resolved from the scroll position every frame instead of
// being pushed around by many scrubbed tweens. Each property follows its own
// list of segments, so the result never depends on which trigger updated
// last, survives any jump in scroll position and is cheap to evaluate.
function createResolver(segments) {
  const tracks = {};
  for (const seg of segments) {
    for (const key of Object.keys(seg.to)) (tracks[key] ||= []).push(seg);
  }
  return (scroll, out) => {
    for (const key in tracks) {
      const list = tracks[key];
      let value = list[0].from[key];
      for (const seg of list) {
        const { start, end } = seg.range;
        if (scroll < start) break;
        if (scroll >= end) {
          value = seg.to[key];
          continue;
        }
        const p = seg.ease((scroll - start) / Math.max(1, end - start));
        value = seg.from[key] + (seg.to[key] - seg.from[key]) * p;
        break;
      }
      out[key] = value;
    }
  };
}

export function initChoreography({ experience, onStep, onCrack }) {
  const mm = gsap.matchMedia();

  mm.add({ mobile: MOBILE_QUERY, desktop: '(min-width: 769px)' }, (context) => {
    const S = getStates(context.conditions.mobile);
    const segments = [];
    const key = (range, from, to, ease = 'power1.inOut') =>
      segments.push({ range, from, to, ease: gsap.parseEase(ease) });
    const between = (trigger, start, end) => slice(ScrollTrigger.create({ trigger, start, end }));

    // ── Hero → product tour
    key(between('#zero', 'top bottom', 'top top'), S.hero, S.sugar);

    // ── Product tour (pinned): one full turn of the can, three facts
    let step = 0;
    const zeroPin = ScrollTrigger.create({
      trigger: '#zero',
      start: 'top top',
      end: '+=300%',
      pin: true,
      onUpdate: (self) => {
        const next = self.progress < 0.29 ? 0 : self.progress < 0.69 ? 1 : 2;
        if (next !== step) {
          step = next;
          onStep?.('zero', step);
        }
        gsap.set('.zero__progress', { '--progress': self.progress });
      },
    });
    key(slice(zeroPin, 0.17, 0.4), S.sugar, S.calories, 'power2.inOut');
    key(slice(zeroPin, 0.57, 0.8), S.calories, S.caffeine, 'power2.inOut');

    // ── Crack it open (pinned)
    key(between('#crack', 'top bottom', 'top top'), S.caffeine, S.crack);
    const crackDom = gsap
      .timeline({ paused: true, defaults: { ease: 'power2.out' } })
      .fromTo('.crack__type span', { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.4, ease: 'power3.out' }, 0)
      .fromTo('.crack__copy--a', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.25 }, 0.2)
      .fromTo('.crack__type', { scale: 1 }, { scale: 1.08, duration: 0.3 }, 0.62)
      .fromTo('.crack__copy--a', { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.2, immediateRender: false }, 1.0)
      .fromTo('.crack__copy--b', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.25 }, 1.15)
      .to({}, { duration: 0.3 }, 1.7); // total length 2 → one unit per 100% of scroll
    let lastCrack = 0;
    const crackPin = ScrollTrigger.create({
      trigger: '#crack',
      start: 'top top',
      end: '+=200%',
      pin: true,
      scrub: true,
      animation: crackDom,
      onUpdate: (self) => {
        // The tab breaks the seal a quarter of the way in (scrolling down only)
        if (lastCrack < 0.24 && self.progress >= 0.24) onCrack?.();
        lastCrack = self.progress;
      },
    });
    const crackKeys = ['tab', 'rx', 'scale', 'bubbles'];
    key(slice(crackPin, 0.15, 0.35), pick(S.crack, ['tab', 'mouth']), pick(S.cracked, ['tab', 'mouth']), 'power2.inOut');
    key(slice(crackPin, 0.3, 0.8), { burst: 0 }, { burst: 1 }, 'none');
    key(slice(crackPin, 0.6, 0.85), pick(S.cracked, crackKeys), pick(S.sprayed, crackKeys), 'power2.inOut');

    // ── Ice cold (pinned)
    key(between('#cold', 'top bottom', 'top top'), S.sprayed, S.cold);
    const temp = { value: 24 };
    const tempEl = document.querySelector('.cold__num');
    const coldDom = gsap
      .timeline({ paused: true })
      .fromTo(
        temp,
        { value: 24 },
        { value: 3, duration: 0.7, ease: 'power1.inOut', onUpdate: () => (tempEl.textContent = Math.round(temp.value)) },
        0,
      )
      .fromTo('.cold__specs li', { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.3 }, 0.3)
      .to({}, { duration: 0.2 }, 0.8);
    const coldPin = ScrollTrigger.create({
      trigger: '#cold',
      start: 'top top',
      end: '+=120%',
      pin: true,
      scrub: true,
      animation: coldDom,
    });
    key(slice(coldPin, 0, 0.8), S.cold, S.frozen);

    // ── Flavors, then off stage, then back for the finale
    key(between('#flavors', 'top bottom', 'top top'), S.frozen, S.flavors);
    key(between('#facts', 'top bottom', 'top 15%'), S.flavors, S.exit);
    // While off screen, jump from above the viewport to below it (a zero-length
    // segment), so the can rises up with the footer instead of crossing the form.
    key(between('#join', 'top 50%', 'top 50%'), S.exit, S.below);
    key(between('#footer', 'top bottom', 'bottom bottom'), S.below, S.footer);

    const resolve = createResolver(segments);
    // Runs at the start of every WebGL frame, after Lenis has moved the page.
    experience.beforeRender = () => resolve(window.scrollY, experience.state);
    return () => (experience.beforeRender = null);
  });

  return mm;
}
