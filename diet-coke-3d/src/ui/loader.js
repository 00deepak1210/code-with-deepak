import gsap from 'gsap';

export function createLoader() {
  const root = document.querySelector('.loader');
  const num = root.querySelector('.loader__num');
  const logo = root.querySelector('.loader__logo');
  const shown = { value: 0 };
  const startedAt = performance.now();

  const render = () => {
    num.textContent = Math.round(shown.value);
    // The wordmark fills with liquid; slightly over-range so the wave's
    // troughs clear the top at 100%.
    logo.style.setProperty('--fill', `${shown.value * 1.2 - 8}%`);
  };

  const setProgress = (p) =>
    gsap.to(shown, { value: Math.max(shown.value, p * 100), duration: 0.6, ease: 'power2.out', onUpdate: render, overwrite: true });

  // Resolves once the loader has animated away.
  const finish = async (minDuration = 1200) => {
    const wait = Math.max(0, minDuration - (performance.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, wait));
    await setProgress(1).then();
    const tl = gsap.timeline();
    tl.to(root.querySelector('.loader__inner'), { yPercent: -30, opacity: 0, duration: 0.6, ease: 'power3.in' })
      .to(root, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, '-=0.25')
      .set(root, { display: 'none' });
    await tl.then();
  };

  return { setProgress, finish };
}
