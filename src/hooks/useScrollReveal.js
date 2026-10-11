import { useEffect, useRef } from 'react';

/**
 * useScrollReveal — attaches IntersectionObserver to add 'visible' class
 * when element enters the viewport. Supports both single refs and containers.
 *
 * @param {object} options - IntersectionObserver options
 * @param {boolean} stagger - If true, adds reveal-stagger behavior
 * @returns React ref to attach to the element
 */
export function useScrollReveal(options = {}, stagger = false) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('visible');
      return;
    }

    el.classList.add(stagger ? 'reveal-stagger' : 'reveal');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el); // Only animate once
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
        ...options,
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return ref;
}

/**
 * useScrollRevealAll — attaches scroll reveal to multiple child elements.
 * Pass a CSS selector to target specific children.
 */
export function useScrollRevealAll(selector = '.reveal-child', options = {}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const children = container.querySelectorAll(selector);
    if (!children.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px',
        ...options,
      }
    );

    children.forEach((child) => {
      child.classList.add('reveal');
      observer.observe(child);
    });

    return () => observer.disconnect();
  }, [selector]);

  return containerRef;
}
