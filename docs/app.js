(() => {
  'use strict';
  const evidence = window.LAPSEF_EVIDENCE;
  const config = window.LAPSEF_SITE || {};
  const $ = s => document.querySelector(s);
  const cohorts = ['Development OOF', 'UCSF', 'Xijing'];
  const repository = $('#repo-link');
  if (/^https:\/\//.test(config.repositoryUrl)) repository.href = config.repositoryUrl;

  $('#auc-table').innerHTML = ['IDH', '1p/19q', 'Grade'].map(task =>
    `<tr><th scope="row">${task}</th>${cohorts.map(cohort => {
      const r = evidence.global_metrics.find(r => r.task === task && r.cohort === cohort);
      return `<td data-task="${task}" data-cohort="${cohort}"><strong>${r.auc.toFixed(3)}</strong><span class="patient-count">n = ${r.n.toLocaleString('en-US')}</span></td>`;
    }).join('')}</tr>`).join('');
  const viewer = $('#figure-viewer');
  let lastFigure;
  document.addEventListener('click', event => {
    const figure = event.target.closest('[data-figure]');
    if (!figure) return;
    lastFigure = figure;
    $('#viewer-title').textContent = figure.dataset.title;
    $('#viewer-image').src = figure.dataset.figure;
    $('#viewer-image').alt = figure.dataset.title;
    $('#viewer-image').style.setProperty('--zoom-width', figure.dataset.wide + 'px');
    $('#viewer-download').href = figure.dataset.figure;
    viewer.classList.remove('zoomed');
    $('#viewer-zoom').textContent = 'Zoom in';
    $('#viewer-zoom').setAttribute('aria-pressed', 'false');
    viewer.showModal();
  });
  $('#viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => lastFigure?.focus({preventScroll: true}));
  $('#viewer-zoom').addEventListener('click', () => {
    const zoomed = viewer.classList.toggle('zoomed');
    $('#viewer-zoom').textContent = zoomed ? 'Fit to window' : 'Zoom in';
    $('#viewer-zoom').setAttribute('aria-pressed', String(zoomed));
  });
  const video = $('#overview-video');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.intersectionRatio >= 0.55)) {
        video.loop = true; video.play().catch(() => {}); observer.disconnect();
      }
    }, {threshold: [0.55]});
    observer.observe(video);
  }
})();
