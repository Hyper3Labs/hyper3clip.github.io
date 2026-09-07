const copyButton = document.querySelector('[data-copy-bibtex]');
const citation = document.querySelector('#bibtex-code code');
const copyStatus = document.querySelector('#copy-status');

if (copyButton && citation && copyStatus) {
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(citation.textContent.trim());
      copyButton.textContent = 'Copied';
      copyStatus.textContent = 'Citation copied to clipboard.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(citation);
      selection.removeAllRanges();
      selection.addRange(range);
      copyButton.textContent = 'Select text';
      copyStatus.textContent = 'Citation selected. Copy it using your browser or keyboard.';
    }

    window.setTimeout(() => {
      copyButton.textContent = 'Copy citation';
    }, 2200);
  });
}

const navLinks = [...document.querySelectorAll('.nav-links a')];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window && sections.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      const isCurrent = link.getAttribute('href') === `#${visible.target.id}`;
      link.toggleAttribute('aria-current', isCurrent);
    });
  }, { rootMargin: '-20% 0px -65% 0px', threshold: [0.05, 0.2, 0.5] });

  sections.forEach((section) => observer.observe(section));
}
