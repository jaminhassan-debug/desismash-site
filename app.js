(function () {
  const C = window.DESI;
  const TZ = 'Europe/London';
  const $ = (id) => document.getElementById(id);
  const money = (n) => '£' + n.toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOWFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const isClosed = () => !!(C.closed && C.closed.on);
  const closedMsg = () => (C.closed && C.closed.message) || 'We are closed right now.';

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
    if (isClosed()) { el.className = 'status closed'; el.textContent = closedMsg(); return; }
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

  const THUMB_SVG = {
    fries: '<path d="M8 12l2-6M14 12l1-8M20 12l3-7M26 12l1-5"/><path d="M6 14h24l-3 18H9z"/>',
    can: '<rect x="10" y="6" width="16" height="26" rx="3"/><path d="M10 12h16M10 26h16"/>',
    dip: '<path d="M8 16h20l-2 14H10z"/><path d="M7 16h22"/><path d="M12 10c2-3 10-3 12 0"/>',
    jar: '<rect x="9" y="12" width="18" height="20" rx="3"/><rect x="11" y="6" width="14" height="6" rx="1.5"/><path d="M13 20h10M13 25h10"/>',
    bag: '<path d="M7 12h22l-2 20H9z"/><path d="M13 12a5 5 0 0 1 10 0"/>'
  };
  function lineThumb(l) {
    const k = String(l.key || '').split('|');
    if (k[0] === 'b' && k[1]) return { src: 'images/' + k[1] + '.jpg' };
    if (k[0] === 's' && k[1]) return { src: 'images/side-' + k[1] + '.jpg' };
    let kind = 'bag';
    if (k[0] === 's') kind = k[1] === 'can' ? 'can' : k[1] === 'dip' ? 'dip' : 'fries';
    if (k[0] === 'p') kind = k[1] === 'spice' ? 'jar' : 'bag';
    return { svg: '<svg viewBox="0 0 36 38" width="34" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + THUMB_SVG[kind] + '</svg>' };
  }
  function renderCart() {
    const n = count();
    $('cart-count').textContent = n;
    $('cartbar-count').textContent = n + (n === 1 ? ' item' : ' items');
    $('cartbar-total').textContent = money(subtotal());
    $('cartbar').hidden = n === 0;
    const confirming = !$('confirm').hidden;
    $('cart-empty').hidden = n > 0 || confirming;
    $('checkout').hidden = n === 0 || confirming;
    const ul = $('cart-lines');
    ul.innerHTML = '';
    cart.forEach((l, i) => {
      const li = document.createElement('li');
      const thumb = lineThumb(l);
      li.className = 'has-img';
      li.innerHTML = '<span class="lt">' + (thumb.src ? '<img alt="" decoding="async" src="' + esc(thumb.src) + '">' : thumb.svg) + '</span><span class="n"></span><span class="lp"></span><span class="d"></span>' +
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

  function setItemImg(src, alt) {
    const im = $('item-img');
    im.hidden = !src;
    if (src) { im.src = src; im.alt = alt; }
  }
  function openBurger(id) {
    if (isClosed()) { toast(closedMsg()); return; }
    const b = C.burgers.find((x) => x.id === id);
    if (!b || C.soldOut.includes(id)) return;
    cur = { type: 'burger', b }; qty = 1;
    const t = C.tiers[b.tier];
    $('item-title').textContent = b.name;
    $('item-desc').textContent = b.desc;
    setItemImg('images/' + b.id + '.jpg', b.name);
    let html = '';
    if (!b.veg) html += '<fieldset class="opt"><legend>Patty</legend>' + radios('patty', C.patties.map((p) => ({ label: p.label, note: p.note })), 1) + '</fieldset>';
    html += '<fieldset class="opt"><legend>Make it a meal?</legend>' + radios('meal', [
      { label: 'Burger only', price: money(t.burger) },
      { label: 'Meal deal', note: 'Burger, seasoned fries and a can', price: money(t.meal) }
    ], 1) + '</fieldset>';
    html += '<div id="meal-extra">' + selectHtml('o-fries', 'Fries seasoning', C.fries) + selectHtml('o-can', 'Can', C.cans) + '</div>';
    const hasS = b.sauces && b.sauces.length, hasR = b.remove && b.remove.length;
    if (hasS || hasR || (C.customise && C.customise.noteMax)) {
      html += '<details class="custom" id="custom-box"><summary><span class="cbtn">Customise</span><span class="ccount" id="custom-count"></span></summary><div class="custom-body">';
      if (hasS) {
        html += '<fieldset class="opt"><legend>Sauces</legend><div class="rm-grid">' +
          '<label class="rm all"><input type="checkbox" id="o-nosauce"><span>No sauce at all</span></label>' +
          b.sauces.map((r, i) => '<label class="rm"><input type="checkbox" name="rs" value="' + i + '"><span>No ' + esc(r) + '</span></label>').join('') + '</div></fieldset>';
      }
      if (hasR) {
        html += '<fieldset class="opt"><legend>Toppings and cheese</legend><div class="rm-grid">' +
          b.remove.map((r, i) => '<label class="rm"><input type="checkbox" name="rm" value="' + i + '"><span>No ' + esc(r.toLowerCase()) + '</span></label>').join('') + '</div></fieldset>';
      }
      if (C.customise && C.customise.noteMax) html += '<label class="note-l">Anything else? <input id="o-note" maxlength="' + C.customise.noteMax + '" placeholder="e.g. well done, cut in half"></label>';
      html += '<p class="fine">Leaving something off does not make a burger allergen-free. Everything is cooked on shared equipment. Tell us about allergies in the note.</p>';
      html += '</div></details>';
    }
    $('item-options').innerHTML = html;
    $('item-options').onchange = (ev) => {
      if (ev.target && ev.target.id === 'o-nosauce') document.querySelectorAll('input[name=rs]').forEach((x) => { x.checked = ev.target.checked; });
      else if (ev.target && ev.target.name === 'rs' && !ev.target.checked && $('o-nosauce')) $('o-nosauce').checked = false;
      refreshPrice(); updateCustomCount();
    };
    $('item-options').oninput = updateCustomCount;
    refreshPrice();
    dlg.showModal();
  }
  function customMods() {
    const b = cur && cur.b;
    const out = [];
    if (!b) return out;
    const all = $('o-nosauce') && $('o-nosauce').checked;
    if (all) out.push('No sauce');
    else document.querySelectorAll('input[name=rs]:checked').forEach((x) => out.push('No ' + b.sauces[+x.value]));
    document.querySelectorAll('input[name=rm]:checked').forEach((x) => out.push('No ' + String(b.remove[+x.value]).toLowerCase()));
    const n = $('o-note') && $('o-note').value.trim();
    if (n) out.push('Note: ' + n);
    return out;
  }
  function updateCustomCount() {
    const el = $('custom-count');
    if (!el) return;
    const n = customMods().length;
    el.textContent = n ? n + ' change' + (n > 1 ? 's' : '') : '';
  }

  function openSide(id) {
    if (isClosed()) { toast(closedMsg()); return; }
    const s = C.sides.find((x) => x.id === id);
    if (!s || C.soldOut.includes(id)) return;
    cur = { type: 'side', s }; qty = 1;
    $('item-title').textContent = s.name;
    $('item-desc').textContent = s.desc;
    setItemImg('images/side-' + s.id + '.jpg', s.name);
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
      const mods = customMods();
      if (mods.length) parts.push(mods.join(', '));
      line = { key: ['b', cur.b.id, patty, meal, meal ? $('o-fries').value : '', meal ? $('o-can').value : '', mods.join('+')].join('|'), name: cur.b.name, detail: parts.join(' · '), unit: unitPrice(), qty, img: 'images/' + cur.b.id + '.jpg', id: cur.b.id, kind: 'burger', meal, patty, mods };
    } else {
      const choice = $('o-choice') ? $('o-choice').value : '';
      line = { key: ['s', cur.s.id, choice].join('|'), name: cur.s.name, detail: choice, unit: cur.s.price, qty, id: cur.s.id, kind: 'side' };
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
      return '<article class="card' + (sold ? ' sold' : '') + '">' +
        '<div class="shot"><img src="images/' + b.id + '.jpg" alt="' + esc(b.name) + '" width="560" height="420" loading="lazy" decoding="async"></div>' +
        '<h3>' + esc(b.name) + '</h3>' +
        '<div class="meta"><span class="tag">' + t.name + '</span>' + (b.veg ? '<span class="tag veg">Vegetarian</span>' : '') + heatHtml(b.heat) + '</div>' +
        '<p>' + esc(b.desc) + '</p>' +
        '<div class="foot"><span class="price">' + money(t.burger) + '<small>meal ' + money(t.meal) + '</small></span>' +
        '<button class="btn primary" data-burger="' + b.id + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : isClosed() ? 'Closed' : 'Add') + '</button></div></article>';
    }).join('');
  }
  function renderSides() {
    $('side-grid').innerHTML = C.sides.map((s) => {
      const sold = C.soldOut.includes(s.id);
      return '<article class="card' + (sold ? ' sold' : '') + '">' +
        '<div class="shot"><img src="images/side-' + esc(s.id) + '.jpg" alt="' + esc(s.name) + '" width="560" height="373" loading="lazy" decoding="async"></div>' +
        '<h3>' + esc(s.name) + '</h3><p>' + esc(s.desc) + '</p>' +
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
  /* ---------- save the order to the private kitchen database ---------- */
  function lineForDb(l) {
    const k = String(l.key || '').split('|');
    const id = l.id || k[1];
    const out = { id, qty: l.qty };
    if (k[0] === 'b') {
      out.meal = l.meal != null ? !!l.meal : k[3] === 'true';
      out.patty = l.patty != null ? l.patty : (k[2] || null);
      out.mods = Array.isArray(l.mods) ? l.mods : [];
      out.detail = l.detail || '';
    } else { out.detail = l.detail || ''; }
    return out;
  }
  async function saveOrder() {
    const O = C.orders;
    if (!O || !O.url || !O.key) return { skipped: true };
    const days = openDays(3);
    const d = days[+$('f-day').value] || days[0];
    const t = +$('f-slot').value;
    const del = mode() === 'Delivery';
    const body = { p: {
      name: $('f-name').value.trim(), phone: $('f-phone').value.trim(), email: $('f-email').value.trim(),
      marketing: $('f-mkt').checked, mode: mode(),
      slot_local: d.date.toISOString().slice(0, 10) + 'T' + clock(t),
      address: del ? $('f-addr').value.trim() : '', postcode: del ? $('f-post').value.trim() : '',
      delivery_fee: del && D.info ? D.info.fee : 0, delivery_miles: del && D.info ? +D.info.miles.toFixed(2) : null,
      notes: $('f-note').value.trim(), source: 'website', items: cart.map(lineForDb)
    } };
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(O.url + '/rest/v1/rpc/place_order', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', apikey: O.key, Authorization: 'Bearer ' + O.key },
        body: JSON.stringify(body)
      });
      clearTimeout(timer);
      const j = await r.json();
      if (!r.ok) return { ok: false, error: j.message || 'Order not saved' };
      return { ok: true, number: j.number };
    } catch (e) { return { ok: false, error: 'offline' }; }
  }

  $('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const msg = buildMessage();
    const snap = orderSnapshot();
    const saving = saveOrder();
    const waUrl = C.whatsapp ? 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg) : '';
    if ($('f-mkt').checked && /.+@.+\..+/.test($('f-email').value)) sendLead({ name: $('f-name').value.trim(), email: $('f-email').value.trim(), phone: $('f-phone').value.trim(), marketing: true, source: 'order' });
    if (waUrl) {
      const a = document.createElement('a');
      a.href = waUrl; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      await copyText(msg);
    }
    showConfirmation(snap, msg, waUrl, null);
    rememberOrder(snap, msg, waUrl, null);
    // The order is now on screen as received; the basket is cleared so it cannot be sent twice by accident.
    cart = []; save(); renderCart();
    $('order-form').reset();
    const r = await saving;
    showConfirmation(snap, msg, waUrl, r);
    rememberOrder(snap, msg, waUrl, r);
  });

  /* ---------- show the confirmation again when the customer comes back from WhatsApp ---------- */
  const LAST_KEY = 'desismash-last-order';
  function rememberOrder(snap, msg, waUrl, r) {
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ snap, msg, waUrl, r: r ? { ok: !!r.ok, skipped: !!r.skipped, number: r.number } : null, at: Date.now() })); } catch (e) { /* storage unavailable */ }
  }
  function forgetOrder() { try { localStorage.removeItem(LAST_KEY); } catch (e) { /* storage unavailable */ } }
  function showLastOrder() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { o = null; }
    if (!o || !o.snap || Date.now() - o.at > 6 * 3600 * 1000) { if (o) forgetOrder(); return; }
    const dlg = $('cart-dialog');
    if (dlg.open) return;
    showConfirmation(o.snap, o.msg, o.waUrl, o.r);
    dlg.showModal();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') showLastOrder(); });
  window.addEventListener('pageshow', showLastOrder);
  $('cart-dialog').addEventListener('close', () => { if (!$('confirm').hidden) forgetOrder(); });
  showLastOrder();

  /* ---------- on-screen order confirmation ---------- */
  function orderSnapshot() {
    const days = openDays(3);
    const d = days[+$('f-day').value] || days[0];
    const del = delivery();
    return {
      name: $('f-name').value.trim(), phone: $('f-phone').value.trim(), email: $('f-email').value.trim(),
      mode: mode(), when: (d ? dayLabel(d) : '') + ' at ' + fmtTime(+$('f-slot').value),
      address: mode() === 'Delivery' ? $('f-addr').value.trim() + ', ' + $('f-post').value.trim() : '',
      lines: cart.map((l) => ({ name: l.qty + 'x ' + l.name + (l.detail ? ' (' + l.detail + ')' : ''), price: l.unit * l.qty })),
      delivery: del, total: subtotal() + del
    };
  }
  function showConfirmation(s, msg, waUrl, r) {
    const saved = r && r.ok;
    const failed = r && !r.ok && !r.skipped;
    $('cart-title').textContent = 'Order received';
    $('cart-empty').hidden = true; $('checkout').hidden = true; $('cart-lines').hidden = true;
    $('cf-title').textContent = 'Thanks ' + s.name.split(' ')[0] + ', we have your order';
    const st = $('cf-status');
    if (!waUrl) st.textContent = 'Your order text is copied. Paste it to Chef Hass on WhatsApp to finish.';
    else if (saved) st.textContent = 'Order #' + r.number + ' received. Waiting on Jay to confirm it. If you have not pressed send in WhatsApp yet, do that now so he sees it.';
    else if (failed) st.textContent = 'We could not save your order online. Please make sure the WhatsApp message is sent, otherwise we will not see it.';
    else st.textContent = 'Order received. Waiting on Jay to confirm it. If you have not pressed send in WhatsApp yet, do that now so he sees it.';
    const rows = [['Name', s.name], ['Mobile', s.phone]];
    if (s.email) rows.push(['Email', s.email]);
    rows.push([s.mode, s.when]);
    if (s.address) rows.push(['Address', s.address]);
    $('cf-details').innerHTML = rows.map((x) => '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>').join('');
    $('cf-lines').innerHTML = s.lines.map((l) => '<li><span>' + esc(l.name) + '</span><span>' + money(l.price) + '</span></li>').join('') +
      (s.mode === 'Delivery' ? '<li><span>Delivery</span><span>' + (s.delivery ? money(s.delivery) : 'Free') + '</span></li>' : '');
    $('cf-total').textContent = money(s.total);
    $('cf-pay').textContent = 'You pay on ' + (s.mode === 'Delivery' ? 'delivery' : 'collection') + '. Your order is only confirmed once Jay replies on WhatsApp.';
    const wa = $('cf-wa');
    if (waUrl) { wa.href = waUrl; wa.hidden = false; } else wa.hidden = true;
    $('cf-copy').onclick = async () => toast((await copyText(msg)) ? 'Order copied' : 'Could not copy');
    $('confirm').hidden = false;
    if (!r) $('confirm').focus();
  }
  function resetCartView() {
    $('confirm').hidden = true;
    $('cart-title').textContent = 'Your basket';
    $('cart-lines').hidden = false;
    renderCart();
  }
  $('cf-done').onclick = () => { $('cart-dialog').close(); };
  $('copy-order').onclick = async () => { if (validate()) toast((await copyText(buildMessage())) ? 'Order copied' : 'Could not copy'); };
  $('clear-cart').onclick = () => { cart = []; save(); renderCart(); };

  $('open-cart').onclick = $('cartbar-btn').onclick = () => { loadSettings(); fillDays(); resetCartView(); $('cart-dialog').showModal(); };
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
    if (isClosed()) { toast(closedMsg()); return; }
    addLine({ key: 'p|' + p.id, name: p.name, detail: p.size + ' · with your weekend order', unit: p.price, qty: 1, id: p.id, kind: 'product' });
  });
  renderShop();

  /* ---------- favourites row and mobile menu ---------- */
  const ICONS = {
    burger: '<path d="M5 24c0-6 6-10 14-10s14 4 14 10z"/><path d="M4 28h30"/><path d="M6 32h26c0 3-3 5-6 5H12c-3 0-6-2-6-5z"/><circle cx="14" cy="19" r=".8"/><circle cx="19" cy="17.5" r=".8"/><circle cx="24" cy="19" r=".8"/>',
    flame: '<path d="M19 4c1 6 8 9 8 17a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 4 2 4 0-5-1-8 2-13z"/>',
    leaf: '<path d="M8 30C8 15 16 8 31 8c0 15-7 23-20 23"/><path d="M8 30L22 16"/>',
    stack: '<path d="M5 14c0-5 6-8 14-8s14 3 14 8z"/><path d="M5 19h28"/><path d="M5 24h28"/><path d="M5 29h28"/><path d="M7 34h24c0 2-3 3-5 3H12c-2 0-5-1-5-3z"/>',
    onion: '<ellipse cx="19" cy="22" rx="11" ry="12"/><path d="M19 10c-4 4-4 20 0 24"/><path d="M19 10c4 4 4 20 0 24"/><path d="M19 10V4"/>'
  };
  function renderStories() {
    const el = $('stories');
    const list = (C.favourites || []).map((f) => ({ f, b: C.burgers.find((x) => x.id === f.id) })).filter((x) => x.b && !C.soldOut.includes(x.b.id));
    if (!list.length) { el.parentElement.hidden = true; return; }
    el.innerHTML = list.map(({ f, b }) =>
      '<button class="st" role="listitem" type="button" data-burger="' + esc(b.id) + '" aria-label="' + esc(b.name) + ', ' + money(C.tiers[b.tier].burger) + '">' +
      '<span class="ring"><span class="face"><img src="images/' + esc(b.id) + '.jpg" alt="" width="560" height="420" loading="lazy" decoding="async"></span></span>' +
      '<span class="st-name">' + esc(b.name.replace(/^The /, '')) + '</span>' +
      '<span class="st-price">' + money(C.tiers[b.tier].burger) + '</span></button>').join('');
  }
  const menuBtn = $('menu-btn'), mainNav = $('main-nav');
  function setMenu(open) {
    mainNav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.classList.toggle('on', open);
  }
  menuBtn.addEventListener('click', () => setMenu(!mainNav.classList.contains('open')));
  mainNav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.top')) setMenu(false); });

  /* ---------- hero photo follows this week's special ---------- */
  function renderHeroImg() {
    const b = C.burgers.find((x) => x.id === C.special);
    const im = $('hero-img');
    if (b && !C.soldOut.includes(b.id)) { im.src = 'images/' + b.id + '-banner.jpg'; im.alt = b.name + ' smash burger'; }
  }

  /* ---------- delivery on/off (set from the kitchen screen) ---------- */
  function applyDelivery(on) {
    C.deliveryOn = on;
    const radio = document.querySelector('input[name=mode][value=Delivery]');
    const seg = radio && radio.closest('label');
    if (seg) seg.hidden = !on;
    document.querySelectorAll('.del-off').forEach((el) => { el.hidden = on; });
    const calc = document.querySelector('.calc');
    if (calc) calc.hidden = !on;
    if (!on) {
      const col = document.querySelector('input[name=mode][value=Collection]');
      if (col && !col.checked) { col.checked = true; col.dispatchEvent(new Event('change', { bubbles: true })); }
      $('addr').hidden = true;
      $('faq-del').textContent = 'We are not delivering right now. Collection only, and it is always free.';
      $('area').textContent = 'Delivery is switched off right now. Collection is free.';
      if (!isClosed()) { $('announce').textContent = 'Collection only right now. Delivery is switched off.'; $('announce').hidden = false; }
    } else {
      $('faq-del').textContent = C.deliveryArea;
      $('area').textContent = 'Delivery: ' + C.deliveryArea;
      if (!isClosed()) { if (C.announcement) { $('announce').textContent = C.announcement; $('announce').hidden = false; } else { $('announce').hidden = true; } }
    }
    renderCart();
  }
  async function loadSettings() {
    const O = C.orders;
    if (!O || !O.url || !O.key) return;
    try {
      const r = await fetch(O.url + '/rest/v1/rpc/public_settings', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', apikey: O.key, Authorization: 'Bearer ' + O.key }, body: '{}'
      });
      if (!r.ok) return;
      const s = await r.json();
      const on = s.delivery_enabled !== false;
      if (on !== (C.deliveryOn !== false)) applyDelivery(on);
    } catch (e) { /* keep the last known state */ }
  }

  /* ---------- boot ---------- */
  $('allergen').textContent = C.allergenNote;
  $('faq-all').textContent = C.allergenNote;
  $('faq-del').textContent = C.deliveryArea;
  $('area').textContent = 'Delivery: ' + C.deliveryArea;
  if (isClosed()) { $('announce').textContent = closedMsg(); $('announce').hidden = false; document.body.classList.add('is-closed'); }
  else if (C.announcement) { $('announce').textContent = C.announcement; $('announce').hidden = false; }
  $('join').href = C.whatsapp ? 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent('Hi Chef Hass, add me to the DesiSmash drop list') : '#';
  if (!C.whatsapp) $('join').setAttribute('aria-disabled', 'true');
  renderStatus(); setInterval(renderStatus, 60000);
  renderChips(); renderBurgers(); renderSides(); renderSpecial(); renderStories(); renderHeroImg();
  linkRow($('apps-row'), [['Uber Eats', 'Order on Uber Eats', C.apps.uberEats], ['Deliveroo', 'Order on Deliveroo', C.apps.deliveroo], ['Just Eat', 'Order on Just Eat', C.apps.justEat]]);
  linkRow($('social-row'), [['Instagram', 'Follow for weekly drops', C.social.instagram], ['TikTok', 'Watch the smash', C.social.tiktok], ['Facebook', 'Join the page', C.social.facebook]]);
  fillDays(); renderCart();
  loadSettings();
  setInterval(loadSettings, 120000);
})();
