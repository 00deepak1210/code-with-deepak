import gsap from 'gsap';
import { FLAVORS } from '../data/flavors.js';

// Flavor switcher: buttons, arrows, keyboard and swipe all funnel into select().
export function initFlavors({ experience, onChange }) {
  const section = document.querySelector('#flavors');
  const buttons = [...section.querySelectorAll('[data-flavor]')];
  const info = section.querySelector('.flavors__info');
  const bigName = section.querySelector('.flavors__bigname span');
  const els = {
    current: info.querySelector('.flavors__current'),
    name: info.querySelector('.flavors__name'),
    tagline: info.querySelector('.flavors__tagline'),
    desc: info.querySelector('.flavors__desc'),
    notes: info.querySelector('.flavors__notes'),
  };
  let index = 0;
  let busy = false;

  const fill = (f) => {
    els.current.textContent = f.index;
    els.name.textContent = f.name;
    els.tagline.textContent = f.tagline;
    els.desc.textContent = f.description;
    els.notes.innerHTML = f.notes.map((n) => `<li>${n}</li>`).join('');
    bigName.textContent = f.name;
  };

  const select = (next, direction = next > index ? 1 : -1) => {
    next = (next + FLAVORS.length) % FLAVORS.length;
    if (next === index || busy) return;
    busy = true;
    index = next;
    const flavor = FLAVORS[index];

    buttons.forEach((b, i) => {
      b.classList.toggle('is-active', i === index);
      b.setAttribute('aria-pressed', String(i === index));
    });

    experience?.switchFlavor(flavor, direction);
    onChange?.(flavor);

    const parts = [els.current, els.name, els.tagline, els.desc, els.notes];
    gsap
      .timeline({ onComplete: () => (busy = false) })
      .to(parts, { y: -24 * direction, opacity: 0, duration: 0.35, stagger: 0.03, ease: 'power2.in' })
      .to(bigName, { yPercent: -100 * direction, opacity: 0, duration: 0.45, ease: 'power3.in' }, 0)
      .add(() => fill(flavor))
      .fromTo(parts, { y: 24 * direction, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out' })
      .fromTo(bigName, { yPercent: 100 * direction, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, '<');
  };

  buttons.forEach((b) => b.addEventListener('click', () => select(Number(b.dataset.flavor))));
  section.querySelectorAll('[data-flavor-step]').forEach((b) =>
    b.addEventListener('click', () => select(index + Number(b.dataset.flavorStep), Number(b.dataset.flavorStep))),
  );

  // Arrow keys while the section is in view
  window.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const r = section.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.5 || r.bottom < window.innerHeight * 0.5) return;
    if (e.target.closest('input, textarea')) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    select(index + dir, dir);
  });

  // Horizontal swipe on touch screens
  let startX = 0;
  let startY = 0;
  section.addEventListener('touchstart', (e) => ({ clientX: startX, clientY: startY } = e.touches[0]), { passive: true });
  section.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const dir = dx < 0 ? 1 : -1;
        select(index + dir, dir);
      }
    },
    { passive: true },
  );

  return { get current() { return FLAVORS[index]; } };
}
