// Grab the can and spin it. Zones marked [data-drag-spin] sit over the can;
// data-drag-spin="mouse" ignores touch (where a swipe already means something
// else). On touch, a mostly vertical gesture is left alone so the page scrolls.
export function initDragSpin(experience) {
  if (!experience) return;
  const hint = document.querySelector('.drag-hint');

  document.querySelectorAll('[data-drag-spin]').forEach((zone) => {
    const mouseOnly = zone.dataset.dragSpin === 'mouse';
    let pointer = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let dragging = false;

    const begin = (e) => {
      dragging = true;
      zone.setPointerCapture(e.pointerId);
      zone.classList.add('is-dragging');
      experience.dragStart();
      hint?.classList.add('is-done');
    };

    zone.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (mouseOnly && e.pointerType === 'touch')) return;
      pointer = e.pointerId;
      startX = lastX = e.clientX;
      startY = e.clientY;
      if (e.pointerType !== 'touch') begin(e);
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      if (!dragging) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx < 8 && dy < 8) return;
        if (dy > dx) {
          pointer = null; // vertical: it's a scroll
          return;
        }
        begin(e);
      }
      experience.dragMove(e.clientX - lastX);
      lastX = e.clientX;
    });

    const end = (e) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      if (!dragging) return;
      dragging = false;
      zone.classList.remove('is-dragging');
      experience.dragEnd();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  });
}
