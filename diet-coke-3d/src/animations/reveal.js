import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Headlines rise line by line from behind a mask as they enter the viewport.
export function initReveals() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.1,
          stagger: 0.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        }),
    });
  });

  // Soft fade-up for supporting copy in the non-pinned sections
  gsap.utils
    .toArray('.facts .eyebrow, .join .eyebrow, .join__text, .join__form, .join__note, .flavors__head, .footer__top')
    .forEach((el) =>
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      }),
    );

  // Facts: numbers roll to their value (zeros count *down* to nothing)
  document.querySelectorAll('.fact').forEach((fact, i) => {
    const num = fact.querySelector('.fact__num');
    const to = Number(num.dataset.count);
    const from = Number(num.dataset.from ?? 0);
    const counter = { value: from };
    num.textContent = from;
    gsap
      .timeline({ scrollTrigger: { trigger: fact, start: 'top 88%', once: true } })
      .from(fact, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', delay: (i % 3) * 0.08 })
      .to(
        counter,
        {
          value: to,
          duration: 1.8,
          ease: 'power3.out',
          onUpdate: () => (num.textContent = Math.round(counter.value)),
        },
        '<0.15',
      );
  });

  // Footer wordmark slides up as the page ends
  gsap.from('.footer__wordmark span', {
    yPercent: 100,
    duration: 1.4,
    stagger: 0.12,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.footer__wordmark', start: 'top 95%', once: true },
  });
}

// Infinite marquee that speeds up and skews with scroll velocity.
export function initMarquee(lenis) {
  const track = document.querySelector('.marquee__track');
  if (!track) return;
  const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  const skew = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3.out' });
  lenis?.on('scroll', ({ velocity }) => {
    const v = gsap.utils.clamp(-40, 40, velocity);
    loop.timeScale(1 + Math.abs(v) / 6);
    skew(-v * 0.25);
  });
}
