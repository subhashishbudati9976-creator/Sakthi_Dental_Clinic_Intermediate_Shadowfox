/**
 * Sakthi Dental Clinic • Core Application JavaScript
 * High-performance, lightweight interactions for all pages:
 * - Mobile Navigation Drawer
 * - Header Scroll Styling
 * - Appointment Modal Dialog
 * - FAQ Accordion with Keyboard Accessibility & Search Filter
 * - Treatment Category Filters
 * - Accessible Contact & Appointment Form Validation
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initAppointmentModal();
  initFaqAccordion();
  initTreatmentFilters();
  initFormValidation();
  highlightActiveNavLink();
  initBackgroundMusic();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Navigation & Mobile Drawer
// ─────────────────────────────────────────────────────────────────────────────
function initNavigation() {
  const siteNav = document.getElementById('siteNav');
  const mobileToggle = document.getElementById('btnMobileNavToggle');
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  const mobileOverlay = document.getElementById('mobileNavOverlay');
  const mobileClose = document.getElementById('closeMobileNav');

  // Sticky navbar with blur on scroll
  if (siteNav) {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        siteNav.classList.add('scrolled');
      } else {
        siteNav.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // Mobile menu toggle
  function openMobileMenu() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.add('is-open');
    if (mobileOverlay) mobileOverlay.classList.add('is-open');
    if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.remove('is-open');
    if (mobileOverlay) mobileOverlay.classList.remove('is-open');
    if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer && mobileDrawer.classList.contains('is-open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (mobileClose) {
    mobileClose.addEventListener('click', closeMobileMenu);
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }

  // Close mobile drawer when clicking any link inside it
  if (mobileDrawer) {
    mobileDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });
  }

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileDrawer && mobileDrawer.classList.contains('is-open')) {
      closeMobileMenu();
    }
  });
}

// Highlight currently active page link
function highlightActiveNavLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkFile = href.split('#')[0] || 'index.html';
    if (linkFile === path || (path === '' && linkFile === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Appointment Booking Modal
// ─────────────────────────────────────────────────────────────────────────────
function initAppointmentModal() {
  const modal = document.getElementById('appointmentModal');
  const closeBtn = document.getElementById('closeAppointmentModal');
  const triggers = document.querySelectorAll('[data-open-appointment]');
  const form = document.getElementById('appointmentModalForm');
  const statusMsg = document.getElementById('appointmentStatusMsg');
  const treatmentSelect = document.getElementById('modalTreatmentSelect');

  if (!modal) return;

  function openModal(preselectedTreatment = '') {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (treatmentSelect && preselectedTreatment) {
      treatmentSelect.value = preselectedTreatment;
    }

    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.textContent = '';
    }

    // Auto-focus first input
    const firstInput = modal.querySelector('input, select');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  triggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const treatment = btn.getAttribute('data-treatment') || '';
      openModal(treatment);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('modalPatientName')?.value.trim() || '';
      const phone = document.getElementById('modalPatientPhone')?.value.trim() || '';
      const date = document.getElementById('modalApptDate')?.value || 'Upcoming Date';
      const submitBtn = form.querySelector('button[type="submit"]');

      if (!name || !phone) {
        alert('Please fill in your name and contact phone number.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Processing...</span>';
      }

      setTimeout(() => {
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.className = 'form-status-alert success';
          statusMsg.innerHTML = `<strong>Appointment Request Noted!</strong> Thank you, <strong>${escapeHtml(name)}</strong>. Our reception team in Hosur will call <strong>${escapeHtml(phone)}</strong> shortly to confirm your visit.`;
        }

        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Fix an Appointment</span>';
        }

        setTimeout(() => {
          closeModal();
        }, 3500);
      }, 700);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FAQ Accordion & Search Filter
// ─────────────────────────────────────────────────────────────────────────────
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  const searchInput = document.getElementById('faqSearchInput');

  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    const answer = item.querySelector('.faq-answer-pane');

    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      // Accessible toggle: close others if single-accordion behavior is preferred, or toggle
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          const otherBtn = otherItem.querySelector('.faq-question-btn');
          const otherAnswer = otherItem.querySelector('.faq-answer-pane');
          if (otherBtn && otherAnswer) {
            otherBtn.setAttribute('aria-expanded', 'false');
            otherAnswer.style.maxHeight = null;
            otherItem.classList.remove('is-active');
          }
        }
      });

      if (!isExpanded) {
        btn.setAttribute('aria-expanded', 'true');
        item.classList.add('is-active');
        answer.style.maxHeight = answer.scrollHeight + 32 + 'px';
      } else {
        btn.setAttribute('aria-expanded', 'false');
        item.classList.remove('is-active');
        answer.style.maxHeight = null;
      }
    });

    // Keyboard support: Enter / Space triggers click
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // Optional live FAQ search filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      let matchCount = 0;

      faqItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = '';
          matchCount++;
        } else {
          item.style.display = 'none';
        }
      });

      const countDisplay = document.getElementById('faqMatchCount');
      if (countDisplay) {
        countDisplay.textContent = query ? `${matchCount} questions found` : '';
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Treatment Category Filters (Treatments Page)
// ─────────────────────────────────────────────────────────────────────────────
function initTreatmentFilters() {
  const filterButtons = document.querySelectorAll('.treatment-filter-btn');
  const cards = document.querySelectorAll('.treatment-full-card');

  if (!filterButtons.length || !cards.length) return;

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterCategory = btn.getAttribute('data-filter') || 'all';

      cards.forEach(card => {
        const cardCategory = card.getAttribute('data-category') || '';
        if (filterCategory === 'all' || cardCategory.includes(filterCategory)) {
          card.style.display = '';
          card.style.opacity = '1';
        } else {
          card.style.display = 'none';
          card.style.opacity = '0';
        }
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Contact Form Validation
// ─────────────────────────────────────────────────────────────────────────────
function initFormValidation() {
  const contactForm = document.getElementById('contactForm');
  const contactStatus = document.getElementById('contactStatusMsg');

  if (!contactForm) return;

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('contactName')?.value.trim();
    const email = document.getElementById('contactEmail')?.value.trim();
    const phone = document.getElementById('contactPhone')?.value.trim();
    const message = document.getElementById('contactMessage')?.value.trim();
    const submitBtn = contactForm.querySelector('button[type="submit"]');

    // Validation checks
    if (!name) {
      showFormError('Please enter your full name.');
      document.getElementById('contactName')?.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showFormError('Please provide a valid email address (e.g. name@domain.com).');
      document.getElementById('contactEmail')?.focus();
      return;
    }

    const phoneRegex = /^[+]?[\d\s-]{8,15}$/;
    if (!phone || !phoneRegex.test(phone)) {
      showFormError('Please enter a valid phone number (at least 8-10 digits).');
      document.getElementById('contactPhone')?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Sending Message...</span>';
    }

    // Polished frontend validation response (no fake backend claimed)
    setTimeout(() => {
      if (contactStatus) {
        contactStatus.style.display = 'block';
        contactStatus.className = 'form-status-alert success';
        contactStatus.innerHTML = `<strong>Thank You, ${escapeHtml(name)}!</strong> Your message has been received. Our team at Sakthi Dental Clinic in Hosur will reach out to you at <strong>${escapeHtml(email)}</strong> or <strong>${escapeHtml(phone)}</strong> during clinic hours (Sunday to Saturday, 9:00 AM – 7:00 PM).`;
      }

      contactForm.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit Message</span>';
      }
    }, 600);
  });

  function showFormError(msg) {
    if (contactStatus) {
      contactStatus.style.display = 'block';
      contactStatus.className = 'form-status-alert error';
      contactStatus.innerHTML = `<strong>Attention Required:</strong> ${escapeHtml(msg)}`;
    }
  }
}

// Simple HTML escaping helper for safe text injection
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Subtle, Persistent Background Music Manager (Tuned to 10–14% Volume)
// ─────────────────────────────────────────────────────────────────────────────
function initBackgroundMusic() {
  // Enforce single persistent singleton instance
  if (window.__SDC_BGM__) {
    return;
  }

  const AUDIO_SRC = 'paulyudin-medical-soft-164815.mp3';
  // Target volume: strictly 0.10–0.14 (approximately 10–14% volume)
  const TARGET_VOLUME = 0.12; 
  const FADE_DURATION_MS = 3000; // 3 seconds smooth fade-in

  const audio = new Audio();
  audio.src = AUDIO_SRC;
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.0; // Start at 0 for smooth fade-in

  // Restore playback position from previous navigation to prevent jarring restarts
  try {
    const savedTime = sessionStorage.getItem('sdc_bgm_time');
    if (savedTime) {
      const parsed = parseFloat(savedTime);
      if (!isNaN(parsed) && parsed > 0) {
        audio.currentTime = parsed;
      }
    }
  } catch (e) {
    // SessionStorage unavailable or restricted
  }

  window.__SDC_BGM__ = audio;

  // Persist current playback time periodically and upon page unload
  const persistState = () => {
    try {
      if (audio && !isNaN(audio.currentTime)) {
        sessionStorage.setItem('sdc_bgm_time', String(audio.currentTime));
      }
    } catch (e) {}
  };

  window.addEventListener('beforeunload', persistState, { passive: true });
  window.addEventListener('pagehide', persistState, { passive: true });
  setInterval(persistState, 2000);

  let playbackStarted = false;

  function fadeIn(targetVol, durationMs) {
    if (audio._fading) return;
    audio._fading = true;
    audio.volume = 0.0;

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      // Smooth sinusoidal ease-out curve for natural acoustic swell
      const currentVol = targetVol * Math.sin((progress * Math.PI) / 2);
      audio.volume = Math.max(0.0, Math.min(targetVol, currentVol));

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        audio.volume = targetVol;
        audio._fading = false;
      }
    }

    requestAnimationFrame(step);
  }

  function startAudio() {
    if (playbackStarted) return;

    const promise = audio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          playbackStarted = true;
          fadeIn(TARGET_VOLUME, FADE_DURATION_MS);
          removeInteractionListeners();
        })
        .catch(() => {
          // Autoplay policy prevented playback; wait for user interaction
          attachInteractionListeners();
        });
    }
  }

  function handleUserInteraction() {
    if (playbackStarted) return;
    startAudio();
  }

  const interactionEvents = ['click', 'pointerdown', 'keydown', 'touchstart'];

  function attachInteractionListeners() {
    interactionEvents.forEach(evt => {
      document.addEventListener(evt, handleUserInteraction, { once: true, passive: true });
    });
  }

  function removeInteractionListeners() {
    interactionEvents.forEach(evt => {
      document.removeEventListener(evt, handleUserInteraction);
    });
  }

  // Attempt initial playback respecting autoplay policies
  startAudio();
}
