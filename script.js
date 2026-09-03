// Enhanced script: live data (weather/time/exchange), pricing with extras, sharing, planner, and auth UI

// --- Live data helpers ---
async function fetchWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    const data = await res.json();
    return data.current_weather; // {temperature, windspeed, weathercode}
  } catch (e) {
    return null;
  }
}

async function fetchLocalTime(timezone) {
  try {
    const url = `https://worldtimeapi.org/api/timezone/${timezone}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('time fetch failed');
    const data = await res.json();
    return data.datetime; // ISO string
  } catch (e) {
    return null;
  }
}

async function fetchExchangeRate(currency) {
  try {
    const url = `https://api.exchangerate.host/latest?base=USD&symbols=${currency}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('exchange fetch failed');
    const data = await res.json();
    return data.rates ? data.rates[currency] : null;
  } catch (e) {
    return null;
  }
}

function formatLocalTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch (e) {
    return iso || '—';
  }
}

// Update live data for all places
async function updateAllLiveData() {
  // sample fallback values used when any live fetch fails
  const samples = {
    paris: { weather: '15°C, Clear', time: new Date().toLocaleString(), exchange: '1 USD = 0.92 EUR' },
    tokyo: { weather: '22°C, Sunny', time: new Date().toLocaleString(), exchange: '1 USD = 149.50 JPY' },
    bali: { weather: '28°C, Sunny', time: new Date().toLocaleString(), exchange: '1 USD = 15600 IDR' }
  };
  const places = document.querySelectorAll('.place');
  for (const p of places) {
    const lat = p.dataset.lat;
    const lon = p.dataset.lon;
    const currency = p.dataset.currency;
    const timezone = p.dataset.timezone;

    const weatherEl = p.querySelector('.weather');
    const timeEl = p.querySelector('.local-time');
    const exchEl = p.querySelector('.exchange');

    const id = p.id || '';
    // Weather
    if (lat && lon) {
      try {
        const w = await fetchWeather(lat, lon);
        if (w) {
          weatherEl.textContent = `${w.temperature}°C, wind ${w.windspeed} km/h`;
        } else {
          const s = samples[id] || {};
          weatherEl.textContent = s.weather || 'N/A';
        }
      } catch (e) {
        const s = samples[id] || {};
        weatherEl.textContent = s.weather || 'N/A';
      }
    }
    // Time
    if (timezone) {
      try {
        const t = await fetchLocalTime(timezone);
        if (t) timeEl.textContent = formatLocalTime(t);
        else timeEl.textContent = (samples[id] && samples[id].time) || 'N/A';
      } catch (e) {
        timeEl.textContent = (samples[id] && samples[id].time) || 'N/A';
      }
    }
    // Exchange
    if (currency) {
      try {
        const r = await fetchExchangeRate(currency);
        if (r) exchEl.textContent = `1 USD = ${r.toFixed(4)} ${currency}`;
        else exchEl.textContent = (samples[id] && samples[id].exchange) || 'N/A';
      } catch (e) {
        exchEl.textContent = (samples[id] && samples[id].exchange) || 'N/A';
      }
    }
  }
}

// --- Pricing ---
function bindPlacePricing(placeId, nightsId, hotelId, totalId) {
  const nightsEl = document.getElementById(nightsId);
  const hotelEl = document.getElementById(hotelId);
  const totalEl = document.getElementById(totalId);
  const place = document.getElementById(placeId);

  function compute() {
    const nights = Math.max(1, Number(nightsEl.value) || 1);
    const perNight = Number(hotelEl.value) || 0;
    let total = nights * perNight;
    const extras = place.querySelectorAll('.extra');
    extras.forEach(ex => {
      if (ex.checked) total += Number(ex.dataset.price || 0);
    });
    totalEl.textContent = total.toFixed(2);
    return total;
  }

  nightsEl.addEventListener('input', compute);
  hotelEl.addEventListener('change', compute);
  const extras = place.querySelectorAll('.extra');
  extras.forEach(ex => ex.addEventListener('change', compute));
  compute();
}

// --- Sharing ---
function initSharing() {
  const buttons = document.querySelectorAll('.share');
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const city = btn.dataset.city || 'this destination';
      const text = `Check out ${city} packages on A World of Adventure!`;
      const url = location.href;
      if (navigator.share) {
        try { await navigator.share({ title: `Travel to ${city}`, text, url }); } catch (e) { /* user cancelled */ }
      } else {
        // fallback to Twitter
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(shareUrl, '_blank');
      }
    });
  });
}

// --- Comments ---
function initComments(cityKey, opts={}){
  // cityKey: 'paris'|'tokyo'|'bali'
  const listEl = document.getElementById(`${cityKey}-comments-list`);
  const form = document.getElementById(`${cityKey}-comment-form`);
  const nameEl = document.getElementById(`${cityKey}-comment-name`);
  const textEl = document.getElementById(`${cityKey}-comment-text`);

  if(!listEl || !form) return;

  const storageKey = `comments_${cityKey}`;

  // default sample comments per city (only used when no stored comments exist)
  const samples = {
    paris: [
      {name:'Amelie', text:'Loved the Musée d\'Orsay — a perfect day for art!', date: '2026-09-01T10:15:00'},
      {name:'Louis', text:'Great pastries and lovely river walks.', date: '2026-08-21T14:30:00'}
    ],
    tokyo: [
      {name:'Hiro', text:'Shibuya at night is unforgettable.', date: '2026-07-12T20:10:00'},
      {name:'Yumi', text:'Try the sushi in Tsukiji — fresh and delicious!', date: '2026-06-02T09:45:00'}
    ],
    bali: [
      {name:'Adi', text:'Ubud rice terraces are stunning at sunrise.', date: '2026-05-05T06:30:00'},
      {name:'Sari', text:'Loved the snorkeling trips — so much marine life!', date: '2026-04-18T11:00:00'}
    ]
  };

  function load(){
    const raw = localStorage.getItem(storageKey);
    if(!raw){
      const initial = samples[cityKey] || [];
      localStorage.setItem(storageKey, JSON.stringify(initial));
      return initial;
    }
    try{ return JSON.parse(raw) }catch(e){ return [] }
  }

  function save(arr){ localStorage.setItem(storageKey, JSON.stringify(arr)) }

  function render(){
    const arr = load();
    listEl.innerHTML = '';
    if(arr.length===0){ listEl.innerHTML = '<div style="color:var(--muted)">No reviews yet. Be the first!</div>'; return }
    arr.slice().reverse().forEach(c=>{
      const el = document.createElement('div'); el.className='comment';
      const meta = document.createElement('div'); meta.className='meta';
      const d = new Date(c.date);
      meta.textContent = `${c.name} · ${d.toLocaleString()}`;
      const txt = document.createElement('div'); txt.className='text'; txt.textContent = c.text;
      el.appendChild(meta); el.appendChild(txt); listEl.appendChild(el);
    });
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = (nameEl.value||'Anonymous').trim();
    const text = (textEl.value||'').trim();
    if(!text) return;
    const arr = load();
    arr.push({name, text, date: new Date().toISOString()});
    save(arr);
    nameEl.value=''; textEl.value='';
    render();
    // keep scroll to top to show newest first
    listEl.scrollTop = 0;
  });

  render();
}

// --- Planner ---
function initPlanner() {
  const destSelect = document.getElementById('plan-destination');
  const extrasContainer = document.getElementById('plan-extras');
  const planBtn = document.getElementById('plan-btn');
  const planResult = document.getElementById('plan-result');

  function populateExtrasFor(dest) {
    extrasContainer.innerHTML = '';
    const place = document.getElementById(dest);
    if (!place) return;
    const extras = place.querySelectorAll('.extra');
    extras.forEach((ex, idx) => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = ex.dataset.price || '0';
      checkbox.dataset.name = ex.parentElement.textContent.trim();
      checkbox.id = `plan-extra-${dest}-${idx}`;
      label.htmlFor = checkbox.id;
      label.style.display = 'block';
      label.appendChild(checkbox);
      label.insertAdjacentText('beforeend', ` ${ex.parentElement.textContent.trim()}`);
      extrasContainer.appendChild(label);
    });
  }

  destSelect.addEventListener('change', (e) => populateExtrasFor(e.target.value));
  populateExtrasFor(destSelect.value);

  planBtn.addEventListener('click', () => {
    const dest = destSelect.value;
    const nights = Number(document.getElementById('plan-nights').value) || 1;
    const start = document.getElementById('plan-start').value || 'TBD';
    // hotel rate: use first hotel option value from the place
    const place = document.getElementById(dest);
    const hotelSelect = place.querySelector('select');
    const perNight = Number(hotelSelect ? hotelSelect.value : 0);
    let extrasTotal = 0;
    const chosenExtras = [];
    extrasContainer.querySelectorAll('input[type="checkbox"]').forEach(ch => {
      if (ch.checked) {
        extrasTotal += Number(ch.value || 0);
        chosenExtras.push(ch.parentElement.textContent.trim());
      }
    });
    const total = nights * perNight + extrasTotal;
    planResult.style.display = 'block';
    planResult.innerHTML = `<strong>Trip to ${dest.charAt(0).toUpperCase()+dest.slice(1)}</strong><br>Start: ${start}<br>Nights: ${nights}<br>Per night: $${perNight}<br>Extras: $${extrasTotal}<br><strong>Estimated total: $${total.toFixed(2)}</strong><br>${chosenExtras.length? 'Extras: '+chosenExtras.join(', '): ''}`;
  });
}

// --- Utilities ---
function isValidEmail(email) {
  const re = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return re.test(email);
}

function logout() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('currentUser');
  location.replace('login.html');
}

// --- Init on page load ---
window.addEventListener('DOMContentLoaded', () => {
  // If opened via file:// protocol, many APIs may fail due to CORS. Show a warning but still attempt live fetches;
  // if any API fails we'll fall back to sample data per place.
  try {
    if (location.protocol === 'file:') {
      const warn = document.getElementById('server-warning');
      if (warn) warn.style.display = 'block';
    }
  } catch (err) {
    console.warn('Protocol check failed', err);
  }
  // Bind pricing for each place
  bindPlacePricing('paris', 'nights-paris', 'hotel-paris', 'total-paris');
  bindPlacePricing('tokyo', 'nights-tokyo', 'hotel-tokyo', 'total-tokyo');
  bindPlacePricing('bali', 'nights-bali', 'hotel-bali', 'total-bali');

  // Signup form
  const form = document.getElementById('signup');
  const email = document.getElementById('email');
  const error = document.getElementById('email-error');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = email.value.trim();
      if (!isValidEmail(value)) {
        error.textContent = 'Enter a valid email like name@domain.com';
        email.focus();
        return;
      }
      error.textContent = '';
      alert('Thanks! You are subscribed.');
      form.reset();
    });
  }

  // Show user and logout button
  try {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const container = document.querySelector('.top-nav .container');
      if (container) {
        const span = document.createElement('span');
        span.style.marginLeft = '12px';
        span.style.fontWeight = '600';
        span.textContent = `Signed in as ${user}`;
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Log out';
        logoutBtn.className = 'btn';
        logoutBtn.style.marginLeft = '10px';
        logoutBtn.addEventListener('click', logout);
        container.appendChild(span);
        container.appendChild(logoutBtn);
      }
    }
  } catch (e) {
    // ignore
  }

  // Live data
  updateAllLiveData();

  // Sharing
  initSharing();

  // Planner
  initPlanner();
});
