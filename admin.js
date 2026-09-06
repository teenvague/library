const palette = window.READING_LOG_PALETTE || [];
let books = [];
let currentSha = null;

const ownerInput = document.querySelector('#repoOwner');
const repoInput = document.querySelector('#repoName');
const branchInput = document.querySelector('#repoBranch');
const pathInput = document.querySelector('#repoPath');
const tokenInput = document.querySelector('#repoToken');
const statusEl = document.querySelector('#githubStatus');
const bookList = document.querySelector('#bookList');
const form = document.querySelector('#bookForm');
const swatches = document.querySelector('#swatches');
const colorValue = document.querySelector('#colorValue');

const settings = JSON.parse(localStorage.getItem('reading-log-github-settings') || '{}');
ownerInput.value = settings.owner || '';
repoInput.value = settings.repo || '';
branchInput.value = settings.branch || 'main';
pathInput.value = settings.path || 'data/books.json';

tokenInput.value = sessionStorage.getItem('reading-log-github-token') || '';

function persistSettings() {
  const next = {
    owner: ownerInput.value.trim(),
    repo: repoInput.value.trim(),
    branch: branchInput.value.trim() || 'main',
    path: pathInput.value.trim() || 'data/books.json'
  };
  localStorage.setItem('reading-log-github-settings', JSON.stringify(next));
  sessionStorage.setItem('reading-log-github-token', tokenInput.value.trim());
  return next;
}

function githubConfig() {
  const settings = persistSettings();
  return { ...settings, token: tokenInput.value.trim() };
}

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeId(title, author, date) {
  const base = slugify(`${title}-${author}-${date}`) || `book-${Date.now()}`;
  let id = base;
  let n = 2;
  while (books.some(book => book.id === id)) id = `${base}-${n++}`;
  return id;
}

function randomPaletteColor() {
  return palette[Math.floor(Math.random() * palette.length)] || '#FFFC58';
}

function reviewToText(review) { return Array.isArray(review) ? review.join('\n\n') : ''; }
function textToReview(text) { return text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean); }

function renderSwatches(selected = colorValue.value) {
  swatches.innerHTML = palette.map(color => `
    <button type="button" class="swatch ${color.toLowerCase() === selected.toLowerCase() ? 'selected' : ''}" data-color="${color}" style="background:${color}" aria-label="${color}"></button>
  `).join('');
  swatches.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => {
    colorValue.value = button.dataset.color;
    renderSwatches(button.dataset.color);
  }));
}

function sortBooks(items) { return [...items].sort((a,b) => b.date.localeCompare(a.date)); }

function renderList(activeId = form.elements.editingId.value) {
  bookList.innerHTML = sortBooks(books).map(book => `
    <button type="button" data-id="${book.id}" class="${book.id === activeId ? 'active' : ''}">
      <span class="book-dot" style="background:${book.status === 'reading' ? `${book.color}33` : book.color}"></span>
      <span class="book-meta">${escapeHtml(book.title)}<small>${escapeHtml(book.author)} · ${book.date}${book.status === 'reading' ? ' · reading' : ''}</small></span>
    </button>
  `).join('');

  bookList.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    const book = books.find(item => item.id === button.dataset.id);
    fillForm(book);
  }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function fillForm(book = null) {
  const chosen = book || {
    id: '', title: '', author: '', date: new Date().toISOString().slice(0,10), status: 'finished', rating: 4,
    color: randomPaletteColor(), review: []
  };
  form.elements.editingId.value = chosen.id || '';
  form.elements.title.value = chosen.title || '';
  form.elements.author.value = chosen.author || '';
  form.elements.date.value = chosen.date || '';
  form.elements.status.value = chosen.status || 'finished';
  form.elements.rating.value = chosen.rating ?? 4;
  form.elements.review.value = reviewToText(chosen.review);
  form.elements.color.value = chosen.color || randomPaletteColor();
  renderSwatches(form.elements.color.value);
  renderList(chosen.id || '');
  syncRatingState();
}

function syncRatingState() {
  const reading = form.elements.status.value === 'reading';
  form.elements.rating.disabled = reading;
}

async function loadLocalFallback() {
  try {
    const response = await fetch(`data/books.json?v=${Date.now()}`, { cache: 'no-store' });
    books = await response.json();
    currentSha = null;
    fillForm(books[0] || null);
    setStatus('Loaded local books.json. Connect GitHub when you are ready to publish.');
  } catch {
    books = [];
    fillForm();
  }
}

async function githubRequest(url, options = {}) {
  const { token } = githubConfig();
  if (!token) throw new Error('Enter a GitHub token first.');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).message || ''; } catch {}
    throw new Error(detail || `GitHub returned ${response.status}.`);
  }
  return response;
}

async function loadFromGithub() {
  const { owner, repo, branch, path } = githubConfig();
  if (!owner || !repo || !path) throw new Error('Owner, repository, and data path are required.');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  const response = await githubRequest(url);
  const payload = await response.json();
  if (payload.type !== 'file' || !payload.content) throw new Error('The configured data path is not a file.');
  const parsed = JSON.parse(decodeBase64Utf8(payload.content));
  if (!Array.isArray(parsed)) throw new Error('books.json must contain an array.');
  books = parsed;
  currentSha = payload.sha;
  fillForm(books[0] || null);
  setStatus(`Loaded ${books.length} books from GitHub.`, 'ok');
}

async function publishToGithub() {
  const { owner, repo, branch, path } = githubConfig();
  if (!owner || !repo || !path) throw new Error('Owner, repository, and data path are required.');

  if (!currentSha) {
    await loadFromGithub();
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const body = {
    message: `Update reading log (${new Date().toISOString().slice(0,10)})`,
    content: encodeBase64Utf8(`${JSON.stringify(sortBooks(books), null, 2)}\n`),
    branch,
    sha: currentSha
  };
  const response = await githubRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  currentSha = payload.content?.sha || null;
  setStatus('Published. GitHub Pages will update after the commit is deployed.', 'ok');
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const editingId = form.elements.editingId.value;
  const title = form.elements.title.value.trim();
  const author = form.elements.author.value.trim();
  const date = form.elements.date.value;
  const status = form.elements.status.value;
  const next = {
    id: editingId || makeId(title, author, date),
    title,
    author,
    date,
    rating: status === 'reading' ? null : Number(form.elements.rating.value || 0),
    color: form.elements.color.value.trim(),
    status,
    review: textToReview(form.elements.review.value)
  };
  const index = books.findIndex(book => book.id === editingId);
  if (index >= 0) books[index] = next; else books.push(next);
  books = sortBooks(books);
  fillForm(next);
  setStatus('Draft saved. Publish when ready.');
});

document.querySelector('#newBook').addEventListener('click', () => fillForm());
document.querySelector('#randomColor').addEventListener('click', () => {
  const color = randomPaletteColor();
  form.elements.color.value = color;
  renderSwatches(color);
});
document.querySelector('#deleteBook').addEventListener('click', () => {
  const id = form.elements.editingId.value;
  if (!id) return;
  const book = books.find(item => item.id === id);
  if (!confirm(`Delete “${book?.title || 'this book'}” from the draft?`)) return;
  books = books.filter(item => item.id !== id);
  fillForm(books[0] || null);
  setStatus('Deleted from draft. Publish when ready.');
});
form.elements.status.addEventListener('change', syncRatingState);
colorValue.addEventListener('change', () => renderSwatches(colorValue.value));

[ownerInput, repoInput, branchInput, pathInput].forEach(input => input.addEventListener('change', persistSettings));
tokenInput.addEventListener('change', persistSettings);

document.querySelector('#loadGithub').addEventListener('click', async () => {
  try { setStatus('Loading from GitHub…'); await loadFromGithub(); }
  catch (error) { console.error(error); setStatus(error.message, 'error'); }
});

document.querySelector('#publishGithub').addEventListener('click', async () => {
  try { setStatus('Publishing…'); await publishToGithub(); }
  catch (error) { console.error(error); setStatus(error.message, 'error'); }
});

renderSwatches('#FFFC58');
loadLocalFallback();
