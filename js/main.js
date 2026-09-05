/**
 * Connect Spread PJ — main.js
 * Minimal, refined interactions
 */

'use strict';

/* ─── Navbar scroll behavior ─────────────────── */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let lastScrollY = 0;
  let ticking = false;

  function updateNavbar() {
    const scrollY = window.scrollY;

    if (scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScrollY = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  }, { passive: true });
})();

/* ─── Mobile navigation toggle ──────────────── */
(function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (!toggle || !navLinks) return;

  let isOpen = false;

  function openMenu() {
    isOpen = true;
    navLinks.classList.add('is-open');
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'メニューを閉じる');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    isOpen = false;
    navLinks.classList.remove('is-open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'メニューを開く');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close on link click
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (isOpen) closeMenu();
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !toggle.contains(e.target) && !navLinks.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeMenu();
      toggle.focus();
    }
  });
})();

/* ─── Active nav link highlight ─────────────── */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link:not(.nav-link--cta)');

  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === `#${id}`) {
            link.style.color = 'var(--color-text-primary)';
          } else {
            link.style.color = '';
          }
        });
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '-80px 0px -40% 0px'
  });

  sections.forEach(section => observer.observe(section));
})();

/* ─── Scroll Reveal ──────────────────────────── */
(function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal-fade, .reveal-up');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  revealEls.forEach(el => observer.observe(el));
})();

/* ─── Hero text entrance ─────────────────────── */
(function initHeroEntrance() {
  // Label
  const label = document.querySelector('.hero-label');
  const headline = document.querySelector('.hero-headline');
  const services = document.querySelector('.hero-services');
  const scroll = document.querySelector('.hero-scroll');

  function animateIn(el, delay, fromY = 0) {
    if (!el) return;
    el.style.opacity = '0';
    if (fromY) el.style.transform = `translateY(${fromY}px)`;
    el.style.transition = 'none';

    setTimeout(() => {
      el.style.transition = `opacity 1s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 1s cubic-bezier(0.22,1,0.36,1) ${delay}ms`;
      el.style.opacity = '1';
      if (fromY) el.style.transform = 'translateY(0)';
    }, 60);
  }

  animateIn(label, 300);
  animateIn(headline, 600, 24);
  animateIn(services, 1000);
  animateIn(scroll, 1500);
})();

/* ─── Smooth scroll for anchor links ────────── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const navbarHeight = document.getElementById('navbar')?.offsetHeight || 80;
      const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
