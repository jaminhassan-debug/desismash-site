(function () {
  const C = window.DESI;
  const TZ = 'Europe/London';
  const $ = (id) => document.getElementById(id);
  const money = (n) => '£' + n.toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOWFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- UK time ---------- */
  function londonNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const g = (t) => +parts.find((p) => p.type === t).value;
    return { y: g('year'), m: g('month'), d: g('day'), mins: g('hour') * 60 + g('minute') };
  }
  const toMins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const fmtTime = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; const ap = h >= 12 ? 'pm' : 'am'; return ((h + 11) % 12 + 1) + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + ap; };
  const clock = (mins) => String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');

  function openDays(count) {
    const now = londonNow();
    const out = [];
    for (let off = 0; off < 14 && out.length < count; off++) {
      const dt = new Date(Date.UTC(now.y, now.m - 1, now.d + off));
      const dow = dt.getUTCDay();
      const h = C.hours[dow];
      if (!h) continue;
      if (off === 0 && now.mins + C.minLeadMinutes > toMins(C.lastOrderTime)) continue;
      out.push({ off, dow, date: dt, open: toMins(h[0]), close: toMins(h[1]) });
    }
    return out;
  }
  const dayLabel = (d) => (d.off === 0 ? 'Today' : DOW[d.dow]) + ' ' + d.date.getUTCDate() + ' ' + MON[d.date.getUTCMonth()];
  function slotsFor(d) {
    const now = londonNow();
    const last = toMins(C.lastOrderTime);
    const res = [];
    for (let t = d.open; t <= last; t += C.slotMinutes) {
      if (d.off === 0 && t < now.mins + C.minLeadMinutes) continue;
      res.push(t);
    }
    return res;
  }

  function renderStatus() {
    const el = $('status');
    const now = londonNow();
    const dow = new Date(Date.UTC(now.y, now.m - 1, now.d)).getUTCDay();
    const h = C.hours[dow];
    el.className = 'status';
    if (h && now.mins >= toMins(h[0]) && now.mins < toMins(h[1])) {
      el.classList.add('open');
      el.textContent = 'Open now · last orders ' + fmtTime(toMins(C.lastOrderTime));
      return;
    }
    el.classList.add('closed');
    if (h && now.mins < toMins(h[0])) { el.textContent = 'Opens today at ' + fmtTime(toMins(h[0])) + ' · pre-order now'; return; }
    for (let off = 1; off < 8; off++) {
      const d = new Date(Date.UTC(now.y, now.m - 1, now.d + off)).getUTCDay();
      if (C.hours[d]) { el.textContent = 'Opens ' + DOWFULL[d] + ' at ' + fmtTime(toMins(C.hours[d][0])) + ' · pre-order now'; return; }
    }
  }

  /* ---------- cart ---------- */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('desismash-cart') || '[]'); } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem('desismash-cart', JSON.stringify(cart)); } catch (e) { /* storage unavailable */ } };
  const subtotal = () => cart.reduce((s, l) => s + l.unit * l.qty, 0);
  const count = () => cart.reduce((s, l) => s + l.qty, 0);
  const mode = () => document.querySelector('input[name=mode]:checked').value;
  const D = { kitchen: null, info: null };
  const normPc = (s) => s.toUpperCase().replace(/\s+/g, '');
  const prettyPc = (n) => n.slice(0, -3) + ' ' + n.slice(-3);
  const delivery = () => (mode() === 'Delivery' && D.info && D.info.ok && D.info.pc === normPc($('f-post').value) ? D.info.fee : 0);

  function addLine(line) {
    const ex = cart.find((l) => l.key === line.key);
    if (ex) ex.qty += line.qty; else cart.push(line);
    save(); renderCart(); toast('Added: ' + line.name);
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function renderCart() {
    const n = count();
    $('cart-count').textContent = n;
    $('cartbar-count').textContent = n + (n === 1 ? ' item' : ' items');
    $('cartbar-total').textContent = money(subtotal());
    $('cartbar').hidden = n === 0;
    $('cart-empty').hidden = n > 0;
    $('checkout').hidden = n === 0;
    const ul = $('cart-lines');
    ul.innerHTML = '';
    cart.forEach((l, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="n"></span><span class="lp"></span><span class="d"></span>' +
        '<div class="ctl"><div class="qty"><button type="button" data-a="m" aria-label="Fewer">−</button><output></output><button type="button" data-a="p" aria-label="More">+</button></div><button class="link" type="button" data-a="r">Remove</button></div>';
      li.querySelector('.n').textContent = l.name;
      li.querySelector('.d').textContent = l.detail || '';
      li.querySelector('.lp').textContent = money(l.unit * l.qty);
      li.querySelector('output').textContent = l.qty;
      li.addEventListener('click', (e) => {
        const a = e.target.dataset && e.target.dataset.a;
        if (!a) return;
        if (a === 'p') l.qty++;
        if (a === 'm') l.qty--;
        if (a === 'r') l.qty = 0;
        if (l.qty <= 0) cart.splice(i, 1);
        save(); renderCart();
      });
      ul.appendChild(li);
    });
    const sub = subtotal(), del = delivery();
    $('t-sub').textContent = money(sub);
    const isDel = mode() === 'Delivery';
    const checked = isDel && D.info && D.info.ok && D.info.pc === normPc($('f-post').value);
    $('t-del-row').hidden = !isDel;
    $('t-del').textContent = checked ? (del === 0 ? 'Free' : money(del)) : 'Enter postcode';
    $('t-total').textContent = money(sub + del);
  }

  /* ---------- item dialog ---------- */
  const dlg = $('item-dialog');
  let cur = null, qty = 1;

  function radios(name, items, checkedIdx) {
    return items.map((it, i) =>
      '<label><input type="radio" name="' + name + '" value="' + i + '"' + (i === checkedIdx ? ' checked' : '') + '>' +
      '<span class="t"><b>' + esc(it.label) + '</b>' + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</span>' +
      (it.price != null ? '<span class="p">' + esc(it.price) + '</span>' : '') + '</label>').join('');
  }
  const selectHtml = (id, label, arr) =>
    '<fieldset class="opt"><legend>' + label + '</legend><select id="' + id + '">' + arr.map((s) => '<option>' + esc(s) + '</option>').join('') + '</select></fieldset>';
  const val = (name) => document.querySelector('input[name=' + name + ']:checked');

  function unitPrice() {
    if (!cur) return 0;
    if (cur.type === 'burger') {
      const t = C.tiers[cur.b.tier];
      return val('meal') && val('meal').value === '1' ? t.meal : t.burger;
    }
    return cur.s.price;
  }
  function refreshPrice() {
    if (cur && cur.type === 'burger') $('meal-extra') && ($('meal-extra').hidden = !(val('meal') && val('meal').value === '1'));
    $('item-price').textContent = money(unitPrice() * qty);
    $('q-val').textContent = qty;
  }

  function openBurger(id) {
    const b = C.burgers.find((x) => x.id === id);
    if (!b || C.soldOut.includes(id)) return;
    cur = { type: 'burger', b }; qty = 1;
    const t = C.tiers[b.tier];
    $('item-title').textContent = b.name;
    $('item-desc').textContent = b.desc;
    let html = '';
    if (!b.veg) html += '<fieldset class="opt"><legend>Patty</legend>' + radios('patty', C.patties.map((p) => ({ label: p.label, note: p.note })), 1) + '</fieldset>';
    html += '<fieldset class="opt"><legend>Make it a meal?</legend>' + radios('meal', [
      { label: 'Burger only', price: money(t.burger) },
      { label: 'Meal deal', note: 'Burger, seasoned fries and a can', price: money(t.meal) }
    ], 1) + '</fieldset>';
    html += '<div id="meal-extra">' + selectHtml('o-fries', 'Fries seasoning', C.fries) + selectHtml('o-can', 'Can', C.cans) + '</div>';
    $('item-options').innerHTML = html;
    $('item-options').onchange = refreshPrice;
    refreshPrice();
    dlg.showModal();
  }

  function openSide(id) {
    const s = C.sides.find((x) => x.id === id);
    if (!s || C.soldOut.includes(id)) return;
    cur = { type: 'side', s }; qty = 1;
    $('item-title').textContent = s.name;
    $('item-desc').textContent = s.desc;
    $('item-options').innerHTML = s.choose ? selectHtml('o-choice', s.choose === 'fries' ? 'Seasoning' : s.choose === 'sauces' ? 'Sauce' : 'Drink', C[s.choose]) : '';
    $('item-options').onchange = null;
    refreshPrice();
    dlg.showModal();
  }

  $('q-plus').onclick = () => { qty = Math.min(qty + 1, 20); refreshPrice(); };
  $('q-minus').onclick = () => { qty = Math.max(qty - 1, 1); refreshPrice(); };
  $('item-add').onclick = () => {
    if (!cur) return;
    let line;
    if (cur.type === 'burger') {
      const meal = val('meal').value === '1';
      const patty = cur.b.veg ? null : C.patties[+val('patty').value].label;
      const parts = [];
      if (patty) parts.push(patty);
      if (meal) parts.push('Meal deal: ' + $('o-fries').value + ' fries, ' + $('o-can').value);
      else parts.push('Burger only');
      line = { key: ['b', cur.b.id, patty, meal, meal ? $('o-fries').value : '', meal ? $('o-can').value : ''].join('|'), name: cur.b.name, detail: parts.join(' · '), unit: unitPrice(), qty };
    } else {
      const choice = $('o-choice') ? $('o-choice').value : '';
      line = { key: ['s', cur.s.id, choice].join('|'), name: cur.s.name, detail: choice, unit: cur.s.price, qty };
    }
    dlg.close();
    addLine(line);
  };
  [dlg, $('cart-dialog')].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  /* ---------- menu render ---------- */
  const heatHtml = (n) => n ? '<span class="heat" title="Spice level ' + n + ' of 3">' + '🌶'.repeat(n) + '</span>' : '';
  let filter = 'all';
  const FILTERS = [['all', 'All'], ['1', 'Classics'], ['2', 'Gourmet'], ['3', 'Heavyweight'], ['veg', 'Vegetarian']];

  function renderChips() {
    $('chips').innerHTML = FILTERS.map(([k, l]) => '<button class="chip" role="tab" data-f="' + k + '" aria-selected="' + (filter === k) + '">' + l + '</button>').join('');
  }
  function renderBurgers() {
    const list = C.burgers.filter((b) => filter === 'all' || (filter === 'veg' ? b.veg : String(b.tier) === filter));
    $('burger-grid').innerHTML = list.map((b) => {
      const t = C.tiers[b.tier], sold = C.soldOut.includes(b.id);
      return '<article class="card' + (sold ? ' sold' : '') + '"><h3>' + esc(b.name) + '</h3>' +
        '<div class="meta"><span class="tag">' + t.name + '</span>' + (b.veg ? '<span class="tag veg">Vegetarian</span>' : '') + heatHtml(b.heat) + '</div>' +
        '<p>' + esc(b.desc) + '</p>' +
        '<div class="foot"><span class="price">' + money(t.burger) + '<small>meal ' + money(t.meal) + '</small></span>' +
        '<button class="btn primary" data-burger="' + b.id + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : 'Add') + '</button></div></article>';
    }).join('');
  }
  function renderSides() {
    $('side-grid').innerHTML = C.sides.map((s) => {
      const sold = C.soldOut.includes(s.id);
      return '<article class="card' + (sold ? ' sold' : '') + '"><h3>' + esc(s.name) + '</h3><p>' + esc(s.desc) + '</p>' +
        '<div class="foot"><span class="price">' + money(s.price) + '</span><button class="btn" data-side="' + s.id + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : 'Add') + '</button></div></article>';
    }).join('');
  }
  $('chips').addEventListener('click', (e) => { const f = e.target.dataset.f; if (f) { filter = f; renderChips(); renderBurgers(); } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-burger]'); if (b) openBurger(b.dataset.burger);
    const s = e.target.closest('[data-side]'); if (s) openSide(s.dataset.side);
  });

  function renderSpecial() {
    const b = C.burgers.find((x) => x.id === C.special);
    if (!b || C.soldOut.includes(b.id)) return;
    const el = $('special');
    el.hidden = false;
    el.innerHTML = '<div class="inner"><div><span class="eyebrow">This week\'s special</span><h3>' + esc(b.name) + '</h3><p>' + esc(b.desc) + '</p></div><button class="btn primary" data-burger="' + b.id + '">Order it</button></div>';
  }

  function linkRow(el, items) {
    el.innerHTML = items.map(([name, sub, url]) => url
      ? '<a class="app live" href="' + esc(url) + '" target="_blank" rel="noopener"><b>' + name + '</b><span>' + sub + '</span></a>'
      : '<div class="app soon"><b>' + name + '</b><span>Coming soon</span></div>').join('');
  }

  /* ---------- delivery fee by distance ---------- */
  const bandMax = () => C.deliveryBands[C.deliveryBands.length - 1].maxMiles;
  const feeFor = (miles) => { for (const b of C.deliveryBands) if (miles <= b.maxMiles) return b.fee; return null; };
  const feeTxt = (f) => (f === 0 ? 'Free' : money(f));
  function haversine(a, b) {
    const R = 3958.8, rad = (x) => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  async function getJSON(u) { const r = await fetch(u); return { status: r.status, json: await r.json() }; }
  async function kitchenCoords() {
    if (D.kitchen) return D.kitchen;
    let res = null;
    if (C.kitchenPostcode) res = await getJSON('https://api.postcodes.io/postcodes/' + encodeURIComponent(normPc(C.kitchenPostcode)));
    if (!res || res.status !== 200) res = await getJSON('https://api.postcodes.io/outcodes/' + encodeURIComponent(C.kitchenOutcode));
    if (res.status !== 200) throw new Error('kitchen');
    D.kitchen = { lat: res.json.result.latitude, lng: res.json.result.longitude };
    return D.kitchen;
  }
  async function checkDelivery(raw) {
    const pc = normPc(raw);
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) return { ok: false, msg: 'Enter a full UK postcode, for example LE3 1AA.' };
    let res;
    try { res = await getJSON('https://api.postcodes.io/postcodes/' + encodeURIComponent(pc)); } catch (e) { return { ok: false, msg: 'Could not check the distance right now. Message us on WhatsApp for a quote.' }; }
    if (res.status === 404) return { ok: false, msg: 'We could not find that postcode. Check it and try again.' };
    if (res.status !== 200) return { ok: false, msg: 'Could not check the distance right now. Message us on WhatsApp for a quote.' };
    let k;
    try { k = await kitchenCoords(); } catch (e) { return { ok: false, msg: 'Could not check the distance right now. Message us on WhatsApp for a quote.' }; }
    const miles = haversine(k, { lat: res.json.result.latitude, lng: res.json.result.longitude }) * C.roadFactor;
    const fee = feeFor(miles);
    if (fee === null) return { ok: false, pc, miles, msg: prettyPc(pc) + ' is about ' + miles.toFixed(1) + ' miles away. We deliver up to ' + bandMax() + ' miles. Collection is free.' };
    return { ok: true, pc, miles, fee, msg: prettyPc(pc) + ': about ' + miles.toFixed(1) + ' miles. Delivery ' + (fee === 0 ? 'is free.' : fee ? money(fee) + '.' : '') };
  }
  async function runCheck(input, out, btn) {
    out.textContent = 'Checking…'; out.classList.remove('bad');
    btn.disabled = true;
    const r = await checkDelivery(input.value);
    btn.disabled = false;
    D.info = r.ok ? r : null;
    out.textContent = r.msg;
    out.classList.toggle('bad', !r.ok);
    if (r.ok) { $('f-post').value = $('c-post').value = prettyPc(r.pc); }
    renderCart();
    return r;
  }
  $('c-check').onclick = () => runCheck($('c-post'), $('c-result'), $('c-check'));
  $('check-fee').onclick = () => runCheck($('f-post'), $('fee-result'), $('check-fee'));
  $('c-post').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('c-check').click(); } });
  $('f-post').addEventListener('input', () => { if (D.info && D.info.pc !== normPc($('f-post').value)) { $('fee-result').textContent = ''; renderCart(); } });
  $('bands').innerHTML = C.deliveryBands.map((b, i) => {
    const from = i === 0 ? 'Under' : (C.deliveryBands[i - 1].maxMiles + ' to');
    const label = i === 0 ? 'Under ' + b.maxMiles + (b.maxMiles === 1 ? ' mile' : ' miles') : C.deliveryBands[i - 1].maxMiles + ' to ' + b.maxMiles + ' miles';
    return '<div class="band"><span>' + label + '</span><b>' + feeTxt(b.fee) + '</b></div>';
  }).join('') + '<div class="band"><span>Collection</span><b>Free</b></div>';

  /* ---------- checkout ---------- */
  function fillDays() {
    const days = openDays(3);
    $('f-day').innerHTML = days.map((d, i) => '<option value="' + i + '">' + dayLabel(d) + '</option>').join('');
    fillSlots();
  }
  function fillSlots() {
    const days = openDays(3);
    const d = days[+$('f-day').value] || days[0];
    const s = d ? slotsFor(d) : [];
    $('f-slot').innerHTML = s.length ? s.map((t) => '<option value="' + t + '">' + fmtTime(t) + '</option>').join('') : '<option value="">No slots left</option>';
  }
  $('f-day').onchange = fillSlots;
  document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
    $('addr').hidden = mode() !== 'Delivery';
    $('del-note').textContent = C.deliveryArea;
    renderCart();
  }));

  function buildMessage() {
    const days = openDays(3);
    const d = days[+$('f-day').value] || days[0];
    const t = +$('f-slot').value;
    const lines = cart.map((l) => l.qty + 'x ' + l.name + (l.detail ? ' (' + l.detail + ')' : '') + ' - ' + money(l.unit * l.qty));
    const sub = subtotal(), del = delivery();
    const out = ['*New DesiSmash order*', '',
      'Name: ' + $('f-name').value.trim(),
      'Mobile: ' + $('f-phone').value.trim(),
      mode() + ': ' + (d ? dayLabel(d) : '') + ' at ' + fmtTime(t)];
    if (mode() === 'Delivery') out.push('Address: ' + $('f-addr').value.trim() + ', ' + $('f-post').value.trim());
    out.push('', ...lines, '', 'Subtotal: ' + money(sub));
    if (mode() === 'Delivery' && D.info) out.push('Delivery (' + D.info.miles.toFixed(1) + ' mi): ' + (del ? money(del) : 'Free'));
    out.push('*Total: ' + money(sub + del) + '* (pay on ' + (mode() === 'Delivery' ? 'delivery' : 'collection') + ')');
    if ($('f-email').value.trim()) out.push('Email: ' + $('f-email').value.trim());
    out.push('Offers OK: ' + ($('f-mkt').checked ? 'yes' : 'no'));
    const note = $('f-note').value.trim();
    if (note) out.push('', 'Notes/allergies: ' + note);
    return out.join('\n');
  }
  function validate() {
    const err = (m) => { const e = $('f-error'); e.textContent = m; e.hidden = false; return false; };
    $('f-error').hidden = true;
    if (!cart.length) return err('Your basket is empty.');
    if (!$('f-slot').value) return err('No pickup slots are left for that day. Choose another day.');
    if ($('f-name').value.trim().length < 2) return err('Enter your name.');
    if ($('f-phone').value.replace(/\D/g, '').length < 10) return err('Enter a mobile number we can reach you on.');
    if (mode() === 'Delivery') {
      if ($('f-addr').value.trim().length < 5 || $('f-post').value.trim().length < 5) return err('Enter your delivery address and postcode.');
      if (!D.info || D.info.pc !== normPc($('f-post').value)) return err('Press "Check delivery fee" so we can confirm your postcode is in our area.');
    }
    return true;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
      ta.remove(); return ok;
    }
  }
  $('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const msg = buildMessage();
    if (!C.whatsapp) {
      const ok = await copyText(msg);
      toast(ok ? 'Order copied. Send it to Chef Hass on WhatsApp.' : 'Ordering number not set up yet.');
      return;
    }
    if ($('f-mkt').checked && /.+@.+\..+/.test($('f-email').value)) sendLead({ name: $('f-name').value.trim(), email: $('f-email').value.trim(), phone: $('f-phone').value.trim(), marketing: true, source: 'order' });
    const a = document.createElement('a');
    a.href = 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
    a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    $('send-note').textContent = 'WhatsApp opened with your order ready to send. Press send there. Chef Hass confirms by reply.';
  });
  $('copy-order').onclick = async () => { if (validate()) toast((await copyText(buildMessage())) ? 'Order copied' : 'Could not copy'); };
  $('clear-cart').onclick = () => { cart = []; save(); renderCart(); };

  $('open-cart').onclick = $('cartbar-btn').onclick = () => { fillDays(); renderCart(); $('cart-dialog').showModal(); };
  $('cart-close').onclick = () => $('cart-dialog').close();

  $('share-site').onclick = async () => {
    const data = { title: C.brand, text: C.tagline + ' in ' + C.city + '. Fri, Sat & Sun.', url: location.href };
    if (navigator.share) { try { await navigator.share(data); return; } catch (e) { /* cancelled */ } }
    toast((await copyText(location.href)) ? 'Link copied' : 'Copy the address bar link');
  };

  /* ---------- email capture and shop ---------- */
  const CONSENT_V = 'v1: name+email used to send recipe; marketing only if box ticked';
  async function sendLead(l) {
    const L = C.leads || {};
    if (!L.endpoint) { console.warn('DesiSmash: leads.endpoint is empty, so this sign-up was not saved anywhere.'); return { ok: true, saved: false }; }
    const rec = Object.assign({}, L.extra, { name: l.name, email: l.email, phone: l.phone || '', marketing_consent: l.marketing ? 'yes' : 'no', source: l.source, consent_wording: CONSENT_V, submitted_at: new Date().toISOString(), page: location.href });
    try {
      const r = await fetch(L.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(rec) });
      return { ok: r.ok, saved: r.ok };
    } catch (e) { return { ok: false }; }
  }
  const leadErr = (m) => { const e = $('l-error'); e.textContent = m; e.hidden = !m; };
  $('l-priv').href = (C.leads && C.leads.privacyUrl) || 'privacy.html';
  $('l-dl').href = (C.leads && C.leads.freePdf) || $('l-dl').href;
  try { if (localStorage.getItem('desismash-lead')) { $('l-name').value = ''; } } catch (e) { /* storage unavailable */ }
  $('lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    leadErr('');
    if ($('l-hp').value) { $('lead-form').hidden = true; $('lead-done').hidden = false; return; }
    const name = $('l-name').value.trim(), email = $('l-email').value.trim();
    if (name.length < 2) return leadErr('Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return leadErr('Enter a valid email address.');
    const btn = $('l-send'); btn.disabled = true; btn.textContent = 'Sending…';
    const r = await sendLead({ name, email, marketing: $('l-mkt').checked, source: 'free-recipe' });
    btn.disabled = false; btn.textContent = 'Send me the free recipe';
    if (!r.ok) return leadErr('Something went wrong. Check your connection and try again.');
    try { localStorage.setItem('desismash-lead', '1'); } catch (x) { /* storage unavailable */ }
    $('lead-form').hidden = true; $('lead-done').hidden = false;
    $('l-note').textContent = $('l-mkt').checked ? 'You are on the weekend specials list. Unsubscribe any time.' : 'Enjoy. You will not get marketing emails from us.';
  });
  function renderShop() {
    $('shop').innerHTML = (C.shop || []).map((p) => {
      let act;
      if (p.type === 'order') act = '<button class="btn primary" data-shop="' + p.id + '">Add to my order</button>';
      else if (p.url) act = '<a class="btn primary" href="' + esc(p.url) + '" target="_blank" rel="noopener">Buy now</a>';
      else act = '<span class="btn" aria-disabled="true">Coming soon</span>';
      return '<article class="card"><span class="tag">' + esc(p.size) + '</span><h3>' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="foot"><span class="price">' + money(p.price) + '</span>' + act + '</div></article>';
    }).join('');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop]'); if (!b) return;
    const p = C.shop.find((x) => x.id === b.dataset.shop);
    addLine({ key: 'p|' + p.id, name: p.name, detail: p.size + ' · with your weekend order', unit: p.price, qty: 1 });
  });
  renderShop();

  /* ---------- boot ---------- */
  $('allergen').textContent = C.allergenNote;
  $('faq-all').textContent = C.allergenNote;
  $('faq-del').textContent = C.deliveryArea;
  $('area').textContent = 'Delivery: ' + C.deliveryArea;
  if (C.announcement) { $('announce').textContent = C.announcement; $('announce').hidden = false; }
  $('join').href = C.whatsapp ? 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent('Hi Chef Hass, add me to the DesiSmash drop list') : '#';
  if (!C.whatsapp) $('join').setAttribute('aria-disabled', 'true');
  renderStatus(); setInterval(renderStatus, 60000);
  renderChips(); renderBurgers(); renderSides(); renderSpecial();
  linkRow($('apps-row'), [['Uber Eats', 'Order on Uber Eats', C.apps.uberEats], ['Deliveroo', 'Order on Deliveroo', C.apps.deliveroo], ['Just Eat', 'Order on Just Eat', C.apps.justEat]]);
  linkRow($('social-row'), [['Instagram', 'Follow for weekly drops', C.social.instagram], ['TikTok', 'Watch the smash', C.social.tiktok], ['Facebook', 'Join the page', C.social.facebook]]);
  fillDays(); renderCart();
})();
