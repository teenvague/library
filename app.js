const DATA_URL = 'data/books.json';

let books = [];
let view = localStorage.getItem('reading-log-view') || 'entry';
const collapsed = new Set(JSON.parse(localStorage.getItem('reading-log-collapsed') || '[]'));

const app = document.querySelector('#app');
const entryToggle = document.querySelector('#entryToggle');
const gridToggle = document.querySelector('#gridToggle');

function safe(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[c]));
}

function isReading(book) { return book.status === 'reading'; }
function monthKey(dateString) { return dateString.slice(0, 7); }
function sortBooks(items) { return [...items].sort((a, b) => b.date.localeCompare(a.date)); }
function grouped(items) {
  const map = new Map();
  for (const book of sortBooks(items)) {
    const key = monthKey(book.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(book);
  }
  return [...map.entries()];
}

function readingDateLabel(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
}

function dateLabel(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  const month = d.toLocaleString('en-US', { month: 'long' });
  return `${month} ${String(d.getDate()).padStart(2, '0')},<br>${d.getFullYear()}`;
}

function backgroundColor(book) {
  const hex = String(book.color || '#ffffff').trim();
  if (isReading(book) && /^#[0-9a-f]{6}$/i.test(hex)) return `${hex}33`; // 20% alpha
  return hex;
}

function saveView() {
  localStorage.setItem('reading-log-view', view);
}

function saveCollapsed() {
  localStorage.setItem('reading-log-collapsed', JSON.stringify([...collapsed]));
}

function renderGrid() {
  app.innerHTML = grouped(books).map(([month, entries]) => `
    <section class="month-section" data-month="${month}">
      <div class="month-grid">
        ${entries.map(book => `
          <button class="book-card" data-id="${safe(book.id)}" style="background:${backgroundColor(book)}">
            <span class="title">${isReading(book) ? '<span class="reading-label">Currently Reading</span>' : ''}${safe(book.title)}<br>${safe(book.author)}</span>
            <span class="date">${isReading(book) ? safe(readingDateLabel(book.date)) : dateLabel(book.date)}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `).join('');

  document.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => {
      view = 'entry';
      saveView();
      render();
      requestAnimationFrame(() => document.getElementById(card.dataset.id)?.scrollIntoView({ block: 'start' }));
    });
  });
}

function renderEntry() {
  const groups = grouped(books);
  app.innerHTML = `<div class="entry-list">${groups.map(([month, entries], groupIndex) => `
    ${groupIndex ? '<hr class="month-rule">' : ''}
    ${entries.map(book => `
      <article class="entry-item ${collapsed.has(book.id) ? 'collapsed' : ''}" id="${safe(book.id)}">
        <button class="entry-bar" data-id="${safe(book.id)}" style="background:${backgroundColor(book)}" aria-expanded="${!collapsed.has(book.id)}">
          <span class="entry-title">${isReading(book) ? '<span class="reading-label">Currently Reading</span>' : ''}${safe(book.title)}<br>${safe(book.author)}</span>
          <span class="entry-date">${isReading(book) ? safe(readingDateLabel(book.date)) : dateLabel(book.date)}</span>
          <span class="entry-rating">${isReading(book) || book.rating == null ? '' : `${safe(book.rating)}/5★`}</span>
        </button>
        <div class="entry-review">${(book.review || []).map(p => `<p>${safe(p)}</p>`).join('')}</div>
      </article>
    `).join('')}
  `).join('')}</div>`;

  document.querySelectorAll('.entry-bar').forEach(bar => {
    bar.addEventListener('click', () => {
      const id = bar.dataset.id;
      collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
      saveCollapsed();
      bar.closest('.entry-item').classList.toggle('collapsed');
      bar.setAttribute('aria-expanded', String(!collapsed.has(id)));
    });
  });
}

function updateToggleState() {
  entryToggle.classList.toggle('active', view === 'entry');
  gridToggle.classList.toggle('active', view === 'grid');
}

function render() {
  app.classList.toggle('view-grid', view === 'grid');
  app.classList.toggle('view-entry', view === 'entry');
  if (!books.length) {
    app.innerHTML = '<div class="error-message">No books yet.</div>';
    updateToggleState();
    return;
  }
  view === 'grid' ? renderGrid() : renderEntry();
  updateToggleState();
}

entryToggle.addEventListener('click', () => {
  view = 'entry';
  saveView();
  render();
});

gridToggle.addEventListener('click', () => {
  view = 'grid';
  saveView();
  render();
});

async function loadBooks() {
  app.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('books.json must contain an array.');
    books = data;
    render();
  } catch (error) {
    console.error(error);
    app.innerHTML = '<div class="error-message">Could not load the reading log.</div>';
    updateToggleState();
  }
}

loadBooks();
