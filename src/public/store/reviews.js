const state = { reviews: [], category: 'all', query: '' };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const imageUrl = (image) => image ? `/${String(image).replace(/^\/+/, '')}` : '/images/cana.jpeg';

function unlockSite() {
  sessionStorage.setItem('canna-age-confirmed', 'true');
  document.body.classList.remove('age-locked');
  $('#ageGate').classList.add('is-hidden');
  $('#siteShell').setAttribute('aria-hidden', 'false');
  loadReviews();
}

$('#confirmAge').addEventListener('click', unlockSite);
$('#rejectAge').addEventListener('click', () => {
  $('#ageQuestion').hidden = true;
  $('#ageDenied').hidden = false;
});

async function loadReviews() {
  $('#reviewsLoading').hidden = false;
  $('#reviewsGrid').innerHTML = '';
  $('#reviewsEmpty').hidden = true;
  $('#shuffleReviews').disabled = true;
  try {
    const response = await fetch('/api/store/reviews', { headers: { 'x-age-confirmed': 'true' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Reviews could not be loaded.');
    state.reviews = payload.reviews || [];
    state.category = 'all';
    renderFilters();
    renderReviews();
  } catch (error) {
    $('#reviewsLoading').innerHTML = `<p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retryReviews">Try again</button>`;
    $('#retryReviews')?.addEventListener('click', loadReviews);
  } finally {
    $('#shuffleReviews').disabled = false;
  }
}

function renderFilters() {
  const categories = new Map(state.reviews.map((review) => [review.product.category.id, review.product.category.name]));
  $('#reviewFilters').innerHTML = [
    '<button class="category-pill active" data-category="all">All products</button>',
    ...[...categories].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => `<button class="category-pill" data-category="${id}">${escapeHtml(name)}</button>`),
  ].join('');
}

function reviewCard(review) {
  const initials = review.author.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(review.date));
  return `<article class="review-card">
    <a class="review-product" href="/#shop">
      <img src="${escapeHtml(imageUrl(review.product.image))}" alt="${escapeHtml(review.product.name)}" loading="lazy">
      <div><small>${escapeHtml(review.product.category.name)}</small><h3>${escapeHtml(review.product.name)}</h3></div>
    </a>
    <div class="review-stars" aria-label="${review.rating} out of 5 stars"><span class="stars-meter" style="--rating:${Number(review.rating) / 5 * 100}%">★★★★★</span><b>${Number(review.rating).toFixed(1)}</b></div>
    <blockquote>“${escapeHtml(review.comment)}”</blockquote>
    <div class="review-byline">
      <div class="review-person"><span class="review-avatar">${escapeHtml(initials)}</span><p>${escapeHtml(review.author)}<small>${review.source === 'customer' ? 'Verified customer' : 'Sample review'}</small></p></div>
      <span class="review-date">${date}</span>
    </div>
  </article>`;
}

function renderReviews() {
  const categoryReviews = state.category === 'all'
    ? state.reviews
    : state.reviews.filter((review) => String(review.product.category.id) === state.category);
  const query = state.query.toLowerCase();
  const reviews = categoryReviews.filter((review) => `${review.product.name} ${review.product.category.name} ${review.author} ${review.comment}`.toLowerCase().includes(query));
  $('#reviewsLoading').hidden = true;
  $('#reviewsGrid').innerHTML = reviews.map(reviewCard).join('');
  $('#reviewsEmpty').hidden = reviews.length > 0;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0;
  $('#averageRating').textContent = reviews.length ? average.toFixed(1) : '—';
  $('#reviewCount').textContent = '2854';
}

$('#reviewFilters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  document.querySelectorAll('#reviewFilters .category-pill').forEach((item) => item.classList.toggle('active', item === button));
  renderReviews();
});

$('#shuffleReviews').addEventListener('click', loadReviews);
$('#reviewSearch').addEventListener('input', (event) => {
  state.query = event.target.value.trim();
  renderReviews();
});
$('#year').textContent = new Date().getFullYear();
if (sessionStorage.getItem('canna-age-confirmed') === 'true') unlockSite();
else requestAnimationFrame(() => $('#confirmAge').focus());
