import gsap from 'gsap';

// A dot that tracks the pointer exactly and a ring that trails behind it,
// growing over anything interactive. Skipped entirely on touch screens.
export function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.querySelector('.cursor');
  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const label = root.querySelector('.cursor__label');
  document.documentElement.classList.add('has-cursor');

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const dotX = gsap.quickSetter(dot, 'x', 'px');
  const dotY = gsap.quickSetter(dot, 'y', 'px');
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    dotX(pos.x);
    dotY(pos.y);
    ringX(pos.x);
    ringY(pos.y);
    root.classList.add('is-visible');
  });
  document.addEventListener('pointerleave', () => root.classList.remove('is-visible'));
  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  const interactive = 'a, button, input, [data-cursor]';
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest(interactive);
    if (!target) return;
    root.classList.add('is-hover');
    label.textContent = target.dataset.cursor || '';
    root.classList.toggle('has-label', Boolean(target.dataset.cursor));
  });
  document.addEventListener('pointerout', (e) => {
    const target = e.target.closest(interactive);
    if (!target || target.contains(e.relatedTarget)) return;
    root.classList.remove('is-hover', 'has-label');
  });
}

// Buttons lean towards the pointer and spring back when it leaves.
export function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.3);
      y((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: true });
    });
  });
}
