'use strict';

const SLIDESHOW_INTERVAL_TENTHS = 50; // 5.0 seconds
const DETAIL_REVEAL_DELAY_MS = 2000; // matches v2's delaySecs

const app = document.getElementById('app');

/** @type {Array<Object>} */
let presidents = [];

// --- Slideshow state ---------------------------------------------------
let slideshowTimerId = null;
let slideshowRemainingTenths = 0;
const isSlideshowRunning = () => slideshowTimerId !== null;

// --- Detail view state (survives soft re-renders triggered by the slideshow) ---
let detailRevealTimerId = null;

function presidentByOrder(order) {
  return presidents.find((p) => p.order === order) || null;
}

function randomPresident(excludingOrder) {
  if (presidents.length === 0) return null;
  if (presidents.length === 1) return presidents[0];
  let candidate;
  do {
    candidate = presidents[Math.floor(Math.random() * presidents.length)];
  } while (excludingOrder !== undefined && candidate.order === excludingOrder);
  return candidate;
}

// --- Routing -------------------------------------------------------------
// Hash formats: '' (home), '#/list', '#/president/<order>'
// Pushing a new hash (assigning location.hash) creates browser history like a
// real navigation push; replaceState is used for "soft" updates (slideshow
// ticks, Previous/Next/Random) that shouldn't grow the back stack, mirroring
// the in-place `index` swaps in the original SwiftUI detail view.

function navigate(hash) {
  location.hash = hash;
}

function softNavigate(hash) {
  history.replaceState(null, '', hash);
  render();
}

window.addEventListener('hashchange', () => {
  if (parseRoute().name !== 'detail') {
    stopSlideshow();
  }
  render();
});

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === '') return { name: 'home' };
  if (hash === 'list') return { name: 'list' };
  const match = hash.match(/^president\/(\d+)$/);
  if (match) return { name: 'detail', order: Number(match[1]) };
  return { name: 'home' };
}

function render() {
  const route = parseRoute();
  if (route.name === 'home') {
    renderHome();
  } else if (route.name === 'list') {
    renderList();
  } else if (route.name === 'detail') {
    renderDetail(route.order);
  } else {
    renderHome();
  }
}

// --- Home ------------------------------------------------------------------

function renderHome() {
  app.innerHTML = `
        <div class="home">
            <div class="icon">🏛️</div>
            <h1>US Presidents</h1>
            <p class="subtitle">Browse portraits and biographies of every US president.</p>
            <div class="actions">
                <button class="btn btn-filled" id="btn-list">📋 List of Presidents</button>
                <button class="btn btn-bordered" id="btn-random">🔀 Random President</button>
                <button class="btn btn-bordered" id="btn-slideshow">
                    ${isSlideshowRunning() ? '⏹ Stop Slideshow' : '▶️ Start Slideshow'}
                </button>
            </div>
            <a class="source-link" href="https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States" target="_blank" rel="noopener">
                🔗 Source: Wikipedia
            </a>
        </div>
    `;

  document.getElementById('btn-list').addEventListener('click', () => navigate('#/list'));
  document.getElementById('btn-random').addEventListener('click', () => {
    const p = randomPresident();
    if (p) navigate(`#/president/${p.order}`);
  });
  document.getElementById('btn-slideshow').addEventListener('click', toggleSlideshow);
}

// --- List --------------------------------------------------------------

function renderList() {
  const rows = presidents
    .map(
      (p) => `
            <li>
                <button class="president-row" data-order="${p.order}">
                    <img class="president-thumb" src="${p.thumbnail ?? ''}" alt="" loading="lazy" />
                    <span class="names">
                        <span class="name">${escapeHTML(p.name)}</span>
                        <span class="term">${escapeHTML(p.term)}</span>
                    </span>
                </button>
            </li>`,
    )
    .join('');

  app.innerHTML = `
        ${navBar('US Presidents', true)}
        <ul class="president-list">${rows}</ul>
    `;

  wireNavBack();
  app.querySelectorAll('.president-row').forEach((row) => {
    row.addEventListener('click', () => {
      navigate(`#/president/${row.dataset.order}`);
    });
  });
}

// --- Detail --------------------------------------------------------------

function renderDetail(order) {
  const president = presidentByOrder(order);
  if (!president) {
    navigate('#/');
    return;
  }

  if (detailRevealTimerId) {
    clearTimeout(detailRevealTimerId);
    detailRevealTimerId = null;
  }

  const imageSrc = president.large || president.thumbnail;
  const image = imageSrc
    ? `<img class="detail-image" src="${imageSrc}" alt="${escapeHTML(president.name)}" />`
    : `<div class="detail-image-placeholder">👤</div>`;

  const index = presidents.findIndex((p) => p.order === order);
  const isFirst = index <= 0;
  const isLast = index >= presidents.length - 1;

  app.innerHTML = `
        ${navBar(titleText(president), true)}
        <div class="detail">
            ${image}
            <div class="detail-text" id="detail-text">
                <h1>${escapeHTML(president.name)}</h1>
                <p class="subtitle">${escapeHTML(president.term)} · ${escapeHTML(president.party)}</p>
                <p>${escapeHTML(president.extract)}</p>
            </div>
        </div>
        <div class="detail-toolbar">
            <button class="toolbar-btn" id="btn-prev" ${isFirst ? 'disabled' : ''}>&larr; Previous</button>
            <button class="toolbar-btn" id="btn-random-detail">&#128256; Random</button>
            <button class="toolbar-btn" id="btn-next" ${isLast ? 'disabled' : ''}>Next &rarr;</button>
        </div>
    `;

  wireNavBack();

  detailRevealTimerId = setTimeout(() => {
    const el = document.getElementById('detail-text');
    if (el) el.classList.add('visible');
  }, DETAIL_REVEAL_DELAY_MS);

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (isFirst) return;
    onManualNavigation();
    softNavigate(`#/president/${presidents[index - 1].order}`);
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (isLast) return;
    onManualNavigation();
    softNavigate(`#/president/${presidents[index + 1].order}`);
  });
  document.getElementById('btn-random-detail').addEventListener('click', () => {
    onManualNavigation();
    const p = randomPresident(order);
    if (p) softNavigate(`#/president/${p.order}`);
  });
}

// Fixed-width (leading-zero, monospaced) title so the number/countdown never jiggle.
function titleText(president) {
  const orderText = String(president.order).padStart(2, '0');
  if (!isSlideshowRunning()) return `#${orderText}`;
  const seconds = (slideshowRemainingTenths / 10).toFixed(1).padStart(4, '0');
  return `#${orderText} · ${seconds}s`;
}

function navBar(title, showBack) {
  return `
        <div class="nav-bar">
            ${showBack ? `<button class="nav-back" id="nav-back">&larr; Back</button>` : `<span class="nav-spacer"></span>`}
            <span class="nav-title">${escapeHTML(title)}</span>
            <span class="nav-spacer"></span>
        </div>
    `;
}

function wireNavBack() {
  const back = document.getElementById('nav-back');
  if (back) back.addEventListener('click', () => history.back());
}

function onManualNavigation() {
  stopSlideshow();
}

// --- Slideshow -------------------------------------------------------------

function toggleSlideshow() {
  if (isSlideshowRunning()) {
    stopSlideshow();
    render();
  } else {
    startSlideshow();
  }
}

function startSlideshow() {
  const p = randomPresident();
  if (!p) return;
  slideshowRemainingTenths = SLIDESHOW_INTERVAL_TENTHS;
  navigate(`#/president/${p.order}`);
  slideshowTimerId = setInterval(tickSlideshow, 100);
}

function tickSlideshow() {
  slideshowRemainingTenths -= 1;
  if (slideshowRemainingTenths <= 0) {
    slideshowRemainingTenths = SLIDESHOW_INTERVAL_TENTHS;
    const route = parseRoute();
    const p = randomPresident(route.name === 'detail' ? route.order : undefined);
    if (p) softNavigate(`#/president/${p.order}`);
  } else if (parseRoute().name === 'detail') {
    const titleEl = document.querySelector('.nav-title');
    const president = presidentByOrder(parseRoute().order);
    if (titleEl && president) titleEl.textContent = titleText(president);
  }
}

function stopSlideshow() {
  if (slideshowTimerId !== null) {
    clearInterval(slideshowTimerId);
    slideshowTimerId = null;
  }
  slideshowRemainingTenths = 0;
}

// --- Utilities -------------------------------------------------------------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// --- Boot --------------------------------------------------------------

fetch('data/presidents.json')
  .then((res) => res.json())
  .then((data) => {
    presidents = data.sort((a, b) => a.order - b.order);
    render();
  })
  .catch((err) => {
    app.innerHTML = `<p style="padding:16px">Failed to load president data: ${escapeHTML(String(err))}</p>`;
  });
