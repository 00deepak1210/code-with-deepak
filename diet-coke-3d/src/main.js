import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import './styles/main.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { FLAVORS, THEMES } from './data/flavors.js';
import { Experience } from './webgl/Experience.js';
import { getStates, initChoreography, MOBILE_QUERY } from './animations/choreography.js';
import { initMarquee, initReveals } from './animations/reveal.js';
import { createLoader } from './ui/loader.js';
import { initCursor, initMagnetic } from './ui/cursor.js';
import { initFlavors } from './ui/flavors.js';
import { initDragSpin } from './ui/drag.js';
import { Fizz } from './ui/sound.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia(MOBILE_QUERY).matches;
const root = document.documentElement;

let experience = null;
let lenis = null;
let currentFlavor = FLAVORS[0];
let activeTheme = 'ink';
const fizz = new Fizz();

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

async function loadFonts() {
  // The can label is painted on a canvas, so the fonts must be ready first.
  const faces = ['900 100px "Archivo Variable"', 'italic 800 100px "Bodoni Moda Variable"', '700 100px "Bodoni Moda Variable"'];
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
  try {
    await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, 'dietCoke N°0123'))), timeout]);
  } catch {
    /* fall back to system fonts */
  }
}

function applyTheme(name) {
  activeTheme = name;
  const theme = name === 'flavor' ? currentFlavor.theme : THEMES[name];
  if (!theme) return;
  gsap.to(root, {
    '--bg': theme.bg,
    '--fg': theme.fg,
    '--accent': theme.accent,
    duration: 0.9,
    ease: 'power2.out',
    overwrite: 'auto',
  });
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme.bg);
  experience?.setBubbleColor(theme.bubble);
}

// Pinned sections are wrapped in a pin-spacer that holds their scroll length;
// measuring the section itself would ignore it.
const outer = (el) => (el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el);

function initThemes() {
  const sections = [...document.querySelectorAll('[data-theme]')];
  sections.forEach((section, i) => {
    const next = sections[i + 1];
    ScrollTrigger.create({
      trigger: outer(section),
      start: 'top 50%',
      endTrigger: next ? outer(next) : outer(section),
      end: next ? 'top 50%' : 'bottom top',
      onToggle: (self) => self.isActive && applyTheme(section.dataset.theme),
    });
  });
}

function setZeroStep(step) {
  const toggle = (selector) =>
    document.querySelectorAll(selector).forEach((el, i) => el.classList.toggle('is-active', i === step));
  toggle('.zero__step');
  toggle('.zero__bgnum');
  toggle('.zero__progress li');
}

function scrollTargetFor(selector) {
  if (selector === '#top') return 0;
  const el = document.querySelector(selector);
  return el ? outer(el) : null;
}

function initNavigation() {
  document.querySelectorAll('[data-scroll-to]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const selector = el.dataset.scrollTo || el.getAttribute('href');
      if (!selector?.startsWith('#')) return;
      const target = scrollTargetFor(selector);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else if (target === 0) window.scrollTo({ top: 0 });
      else target.scrollIntoView();
    });
  });

  // Hide the nav while scrolling down, bring it back when scrolling up
  const nav = document.querySelector('.nav');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-hidden', y > lastY && y > 200);
      nav.classList.toggle('is-scrolled', y > 40);
      lastY = y;
    },
  });
}

function initSound() {
  const button = document.querySelector('.sound-btn');
  button.addEventListener('click', async () => {
    const on = await fizz.toggle();
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Sound on. Turn off the fizz' : 'Sound off. Turn on the fizz');
  });
}

function initJoinForm() {
  const form = document.querySelector('.join__form');
  const msg = document.querySelector('.join__msg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = 'Hmm, that email looks a little flat. Try again?';
      msg.dataset.state = 'error';
      form.elements.email.focus();
      return;
    }
    msg.textContent = "You're on the list. Keep it chilled.";
    msg.dataset.state = 'ok';
    form.reset();
  });
}

async function playIntro() {
  const tl = gsap.timeline();
  tl.from('.hero__word', { yPercent: 105, duration: 1.5, ease: 'expo.out', stagger: 0.12 }, 0)
    .from('.nav > *', { y: -30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }, 0.4)
    .from(
      '.hero__content > *, .hero__meta li, .hero__scroll, .drag-hint',
      { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.06 },
      0.6,
    )
    .from('.hero__glow', { opacity: 0, scale: 0.6, duration: 2, ease: 'power2.out' }, 0);
  if (experience) tl.to(experience.state, { ...getStates().hero, duration: 2.6, ease: 'expo.out' }, 0.05);
  await tl.then();
}

async function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const loader = createLoader();
  loader.setProgress(0.1);

  if (!reducedMotion) {
    lenis = new Lenis({ duration: 1.25, smoothWheel: true });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  await loadFonts();
  loader.setProgress(0.35);

  if (webglAvailable()) {
    try {
      experience = new Experience(document.querySelector('.webgl'), { flavor: currentFlavor, reducedMotion, isMobile });
      await experience.init((p) => loader.setProgress(0.35 + p * 0.6));
    } catch (err) {
      console.error('WebGL scene failed to start', err);
      experience = null;
    }
  }
  if (!experience) root.classList.add('no-webgl');

  initCursor();
  initMagnetic();
  initDragSpin(experience);
  initJoinForm();
  initSound();
  initFlavors({
    experience,
    onChange: (flavor) => {
      currentFlavor = flavor;
      if (activeTheme === 'flavor') applyTheme('flavor');
      fizz.crack(0.3);
    },
  });

  await loader.finish();
  document.body.classList.remove('is-loading');
  await playIntro();

  if (experience) {
    initChoreography({
      experience,
      onStep: (_chapter, step) => setZeroStep(step),
      onCrack: () => fizz.crack(),
    });
    experience.prepareFlavors(FLAVORS);
  }
  initThemes();
  initReveals();
  initMarquee(lenis);
  initNavigation();
  ScrollTrigger.refresh();
  lenis?.resize(); // the pins just made the page much taller
  lenis?.start();
  if (import.meta.env.DEV) window.__app = { experience, lenis, ScrollTrigger };
}

boot();
