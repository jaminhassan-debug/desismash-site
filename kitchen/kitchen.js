(function () {
  const C = window.DESI || {};
  const O = C.orders || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '£' + Number(n || 0).toFixed(2);
  const TZ = 'Europe/London';
  const fmtT = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d));
  const fmtD = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
  const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
  const mins = (ms) => Math.round(ms / 60000);
  const toast = (m) => { const t = $('toastk'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200); };

  if (!window.supabase || !O.url || !O.key) { $('login-msg').textContent = 'Database settings are missing.'; $('login-msg').hidden = false; return; }
  const sb = window.supabase.createClient(O.url, O.key, { auth: { persistSession: true, autoRefreshToken: true } });

  const ALLERGY_RE = /allerg|nut|peanut|gluten|coeliac|celiac|dairy|lactose|sesame|egg|mustard|shellfish|fish|soy|intoleran/i;
  let role = 'owner', deliveryOn = true, confirmT = null, mf = 'all', staffRows = [];
  const PERM = {
    owner:   { tabs: ['kitchen', 'orders', 'customers', 'cash', 'team'], totals: true, pay: true, delivery: true, customers: true },
    manager: { tabs: ['kitchen', 'orders', 'customers', 'cash'], totals: true, pay: true, delivery: true, customers: true },
    counter: { tabs: ['kitchen'], totals: true, pay: true, delivery: false, customers: false },
    kitchen: { tabs: ['kitchen'], totals: false, pay: false, delivery: false, customers: false },
    driver:  { tabs: ['kitchen'], totals: false, pay: true, delivery: false, customers: false }
  };
  const can = (k) => (PERM[role] || PERM.kitchen)[k];
  const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', counter: 'Counter', kitchen: 'Kitchen', driver: 'Driver' };
  let orders = [], customers = [], tab = 'kitchen', ofilter = 'all', mktOnly = false, lastNew = -1, soundOn = false, channel = null, reloadT = null;

  /* ---------- auth ---------- */
  // Keep the screen on while the kitchen board is open. The browser releases the lock when the tab is hidden, so ask again when it returns.
  let wake = null;
  function keepAwake() { try { if (navigator.wakeLock && !$('app').hidden) navigator.wakeLock.request('screen').then((l) => { wake = l; }).catch(() => {}); } catch (e) { /* optional */ } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
  function showLogin(msg) { $('app').hidden = true; $('login').hidden = false; if (msg) { $('login-msg').textContent = msg; $('login-msg').hidden = false; } }
  async function enter() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return showLogin();
    const me = ((data.session.user && data.session.user.email) || '').toLowerCase();
    const { data: staff, error } = await sb.from('staff').select('email,role');
    const mine = staff && staff.find((s) => String(s.email).trim().toLowerCase() === me);
    if (error || !mine) {
      await sb.auth.signOut();
      return showLogin('This account does not have kitchen access yet. Ask the owner to add your email.');
    }
    role = PERM[mine.role] ? mine.role : 'kitchen';
    staffRows = staff || [];
    $('login').hidden = true; $('app').hidden = false;
    applyRole();
    await loadAll(); subscribe(); tick();
    keepAwake();
  }
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); $('login-msg').hidden = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) { $('login-msg').textContent = error.message; $('login-msg').hidden = false; return; }
    enter();
  });
  $('signup').addEventListener('click', async () => {
    const { error } = await sb.auth.signUp({ email: $('email').value.trim(), password: $('password').value });
    $('login-msg').textContent = error ? error.message : 'Account created. Check your email to confirm it, then sign in. You also need to be added to the staff list.';
    $('login-msg').hidden = false;
  });
  $('signout').addEventListener('click', async () => { await sb.auth.signOut(); if (channel) sb.removeChannel(channel); showLogin(); });

  function applyRole() {
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = !can('tabs').includes(t.dataset.tab); });
    $('deliv').hidden = !can('delivery');
    $('role').textContent = ROLE_LABEL[role] || role;
  }

  /* ---------- data ---------- */
  // Quantities and prep times must be plain numbers, so one malformed order can never break the board or put markup on screen.
  function clean(list) {
    (list || []).forEach((o) => (o.order_items || []).forEach((i) => { i.qty = Math.max(0, parseInt(i.qty, 10) || 0); i.patties = Math.max(0, Number(i.patties) || 0); i.prep_minutes = Math.max(0, Number(i.prep_minutes) || 0); }));
    return list;
  }
  async function loadAll() {
    if (role === 'kitchen' || role === 'driver' || role === 'counter') {
      const r = await sb.rpc('kitchen_tickets');
      if (r.error) { toast('Could not load tickets: ' + r.error.message); return; }
      orders = (r.data || []).map((t) => ({
        id: t.id, number: t.number, mode: t.mode, slot_at: t.slot_at, status: t.status, created_at: t.created_at, ready_at: t.ready_at,
        delivery_miles: t.delivery_miles, notes: t.notes, address: t.address, postcode: t.postcode,
        customers: { name: t.name || t.first_name, phone: t.phone }, order_items: t.items || [],
        total: t.total, delivery_fee: t.delivery_fee || 0, payment_method: t.payment_method || 'pay_on_receipt'
      }));
      clean(orders);
      customers = [];
      const nc = orders.filter((x) => x.status === 'new').length;
      if (lastNew >= 0 && nc > lastNew && soundOn) beep();
      lastNew = nc;
      render();
      return;
    }
    if (can('delivery')) {
      sb.from('site_settings').select('key,value').eq('key', 'delivery_enabled').then((r) => {
        if (r && r.data && r.data[0]) { deliveryOn = r.data[0].value !== false; paintDelivery(); }
      });
    }
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
    const [o, c] = await Promise.all([
      sb.from('orders').select('*, customers(name,phone,email,marketing_consent), order_items(*)').gte('created_at', since).order('slot_at', { ascending: true }).limit(1000),
      can('customers') ? sb.from('customer_summary').select('*').order('last_order_at', { ascending: false, nullsFirst: false }).limit(2000) : Promise.resolve({ data: [] })
    ]);
    if (o.error) { toast('Could not load orders: ' + o.error.message); }
    orders = clean(o.data || []);
    customers = c.data || [];
    const newCount = orders.filter((x) => x.status === 'new').length;
    if (lastNew >= 0 && newCount > lastNew && soundOn) beep();
    lastNew = newCount;
    render();
  }
  function paintDelivery() {
    const b = $('deliv');
    b.textContent = 'Delivery: ' + (deliveryOn ? 'ON' : 'OFF');
    b.classList.toggle('g', deliveryOn);
    b.classList.toggle('r', !deliveryOn);
    b.setAttribute('aria-pressed', String(deliveryOn));
  }
  $('deliv').addEventListener('click', async () => {
    const b = $('deliv');
    if (!confirmT) {
      b.textContent = deliveryOn ? 'Tap again: switch delivery OFF' : 'Tap again: switch delivery ON';
      confirmT = setTimeout(() => { confirmT = null; paintDelivery(); }, 4000);
      return;
    }
    clearTimeout(confirmT); confirmT = null;
    const next = !deliveryOn;
    const { error } = await sb.from('site_settings').update({ value: next }).eq('key', 'delivery_enabled');
    if (error) { toast('Could not change delivery: ' + error.message); paintDelivery(); return; }
    deliveryOn = next; paintDelivery();
    toast(next ? 'Delivery is ON. The website now offers delivery.' : 'Delivery is OFF. The website is collection only.');
  });
  function subscribe() {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_pings' }, queueReload)
      .subscribe((s) => { $('live').classList.toggle('on', s === 'SUBSCRIBED'); $('live-t').textContent = s === 'SUBSCRIBED' ? 'Live' : 'Reconnecting'; });
    setInterval(() => loadAll(), 60000);
  }
  function queueReload() { clearTimeout(reloadT); reloadT = setTimeout(loadAll, 250); }
  async function setStatus(id, status, silent, pay) {
    const o = orders.find((x) => x.id === id);
    const prev = o && o.status;
    const { error } = await sb.rpc('set_order_status', { p_id: id, p_status: status, p_payment: pay || null });
    if (error) { toast('Could not update: ' + error.message); return; }
    if (o) { o.status = status; if (pay) o.payment_method = pay; }
    render();
    if (!silent && prev && prev !== status) undoToast('#' + (o ? o.number : '') + ' → ' + status, () => setStatus(id, prev, true));
    loadAll();
  }
  function undoToast(msg, fn) {
    const t = $('toastk');
    t.textContent = msg + ' ';
    const b = document.createElement('button');
    b.className = 'undo'; b.textContent = 'Undo';
    b.onclick = () => { t.hidden = true; fn(); };
    t.appendChild(b); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 8000);
  }

  /* ---------- the smart queue ---------- */
  function estimate(o) {
    const items = o.order_items || [];
    let sum = 0, longest = 0;
    items.forEach((i) => { const m = Number(i.prep_minutes || 0) * i.qty; sum += m; longest = Math.max(longest, Number(i.prep_minutes || 0)); });
    const cook = 1.5 + Math.max(longest, 0.65 * sum);
    const buffer = o.mode === 'Delivery' ? 6 + 4 * Number(o.delivery_miles || 1) : 2;
    return { cook: Math.ceil(cook), buffer: Math.ceil(buffer) };
  }
  function plan(o, now) {
    const e = estimate(o);
    const slot = new Date(o.slot_at).getTime();
    const startBy = slot - (e.cook + e.buffer) * 60000;
    const slack = mins(startBy - now);
    let cls = 'ok', label = 'Start in ' + slack + ' min';
    if (slack <= 0) { cls = 'late'; label = slack === 0 ? 'START NOW' : 'LATE: start now (' + Math.abs(slack) + ' min behind)'; }
    else if (slack <= 5) { cls = 'soon'; label = 'Start in ' + slack + ' min'; }
    const why = 'Due ' + fmtT(slot) + ' · ~' + e.cook + ' min to cook' + (o.mode === 'Delivery' ? ' + ' + e.buffer + ' min delivery (' + Number(o.delivery_miles || 0).toFixed(1) + ' mi)' : ' + ' + e.buffer + ' min pack') + ' · start by ' + fmtT(startBy);
    return { cls, label, why, startBy, slack, slot };
  }

  /* ---------- render ---------- */
  function itemsHtml(o) {
    return '<div class="items">' + (o.order_items || []).map((i) => {
      const mods = (i.mods || []).filter(Boolean);
      const meal = i.meal ? '+ fries &amp; can' : '';
      const detail = [i.patty, meal].filter(Boolean).join(' · ');
      return '<div class="it"><span class="q">' + esc(i.qty) + '×</span><span class="n">' + esc(i.name) + '</span>' +
        (detail ? '<span class="d">' + (i.patty ? esc(i.patty) : '') + (i.patty && i.meal ? ' · ' : '') + meal + '</span>' : '') +
        (mods.filter((m) => !/^note:/i.test(m)).length ? '<span class="m">' + esc(mods.filter((m) => !/^note:/i.test(m)).join(' · ')) + '</span>' : '') +
        mods.filter((m) => /^note:/i.test(m)).map((m) => '<span class="m nt' + (ALLERGY_RE.test(m) ? ' allergy' : '') + '">⚠ ' + esc(m) + '</span>').join('') + '</div>';
    }).join('') + '</div>';
  }
  function ticket(o, now, opts) {
    const p = plan(o, now);
    const cust = o.customers || {};
    const cls = opts.kind === 'todo' ? p.cls : opts.kind;
    const due = opts.kind === 'ready'
      ? '<b>' + fmtT(o.slot_at) + '</b><span>' + (mins(now - new Date(o.ready_at || o.slot_at).getTime()) <= 0 ? 'just ready' : 'waiting ' + mins(now - new Date(o.ready_at || o.slot_at).getTime()) + ' min') + '</span>'
      : '<b>' + fmtT(o.slot_at) + '</b><span>' + esc(opts.kind === 'cook' ? (p.slack <= 0 ? 'due in ' + Math.max(0, mins(p.slot - now)) + ' min' : 'due in ' + Math.max(0, mins(p.slot - now)) + ' min') : p.label) + '</span>';
    let act = '';
    if (o.status === 'new') act = '<button class="btn p" data-a="cooking" data-id="' + esc(o.id) + '">Accept &amp; start cooking</button><button class="btn" data-a="accepted" data-id="' + esc(o.id) + '">Accept only</button>' + (role === 'kitchen' ? '' : '<button class="btn r sm" data-a="cancelled" data-id="' + esc(o.id) + '">Cancel</button>');
    else if (o.status === 'accepted') act = '<button class="btn p" data-a="cooking" data-id="' + esc(o.id) + '">Start cooking</button>' + (role === 'kitchen' ? '' : '<button class="btn r sm" data-a="cancelled" data-id="' + esc(o.id) + '">Cancel</button>');
    else if (o.status === 'cooking') act = '<button class="btn g" data-a="ready" data-id="' + esc(o.id) + '">Ready</button>';
    else if (o.status === 'ready' && role === 'kitchen') act = '<div class="empty" style="padding:6px">Ready. Waiting for handover.</div>';
    else if (o.status === 'ready') act = '<div class="btns2"><button class="btn b" data-a="done" data-pay="card" data-id="' + esc(o.id) + '">Paid card · ' + (o.mode === 'Delivery' ? 'delivered' : 'handed over') + '</button><button class="btn g" data-a="done" data-pay="cash" data-id="' + esc(o.id) + '">Paid cash · ' + (o.mode === 'Delivery' ? 'delivered' : 'handed over') + '</button></div><button class="btn sm" data-a="done" data-id="' + esc(o.id) + '">Handed over, record payment later</button>';
    const allergy = ALLERGY_RE.test(o.notes || '') || (o.order_items || []).some((i) => (i.mods || []).some((m) => ALLERGY_RE.test(m)));
    const hasNote = !!(o.notes || (o.order_items || []).some((i) => (i.mods || []).some((m) => /^note:/i.test(m))));
    const age = mins(now - new Date(o.created_at).getTime());
    return '<article class="tk ' + cls + (opts.next ? ' next' : '') + (o.status === 'new' ? ' isnew' : '') + (allergy ? ' hasallergy' : hasNote ? ' hasnote' : '') + '">' +
      (o.status === 'new' ? '<div class="newbar"><span>New order</span><span>' + (age <= 0 ? 'just now' : age + ' min ago') + '</span></div>' : '') +
      '<div class="tk-h"><span class="num">#' + esc(o.number) + '</span><div class="grow"><div class="who">' + esc(cust.name || 'Customer') + '</div><div class="sub">' + esc(cust.phone || '') + '</div></div>' +
      '<div class="due">' + due + '</div></div>' +
      '<div><span class="mode ' + (o.mode === 'Delivery' ? 'd' : 'c') + '">' + esc(o.mode) + '</span> ' + (opts.next ? '<span class="nextbadge">Cook next</span>' : '') + ' <span class="sub">' + fmtD(o.slot_at) + (can('totals') ? ' · ' + (o.payment_method === 'pay_on_receipt' ? 'pay on ' + (o.mode === 'Delivery' ? 'delivery' : 'collection') : 'paid ' + esc(o.payment_method)) : '') + '</span></div>' +
      (can('totals') ? '<div class="valrow"><span class="val">' + money(o.total) + '</span><span class="vsub">' + (Number(o.delivery_fee) > 0 ? 'incl. ' + money(o.delivery_fee) + ' delivery' : (o.mode === 'Delivery' ? 'free delivery' : 'collection')) + '</span></div>' : '') +
      (opts.kind === 'todo' ? '<div class="why">' + esc(p.why) + '</div>' : '') +
      itemsHtml(o) +
      (o.notes ? '<div class="note' + (ALLERGY_RE.test(o.notes) ? ' allergy' : '') + '"><span class="tag">' + (ALLERGY_RE.test(o.notes) ? 'Allergy' : 'Note') + '</span><span>' + esc(o.notes) + '</span></div>' : '') +
      (o.mode === 'Delivery' && o.address ? '<div class="addr">📍 ' + esc(o.address) + (o.postcode ? ', ' + esc(o.postcode) : '') + '</div>' : '') +
      '<div class="acts">' + act + '</div></article>';
  }
  function renderKitchen() {
    const now = Date.now();
    const today = dayKey(now);
    const keep = (o) => mf === 'all' || o.mode === mf;
    const todo = orders.filter(keep).filter((o) => o.status === 'new' || o.status === 'accepted')
      .map((o) => ({ o, p: plan(o, now) })).sort((a, b) => a.p.startBy - b.p.startBy || (b.o.mode === 'Delivery') - (a.o.mode === 'Delivery'));
    const cook = orders.filter(keep).filter((o) => o.status === 'cooking').sort((a, b) => new Date(a.slot_at) - new Date(b.slot_at));
    const ready = orders.filter(keep).filter((o) => o.status === 'ready').sort((a, b) => new Date(a.slot_at) - new Date(b.slot_at));
    const nNew = orders.filter((o) => o.status === 'new').length;
    const nNote = todo.concat(cook.map((o) => ({ o }))).filter((x) => x.o && x.o.notes).length;
    document.title = (nNew ? '(' + nNew + ') ' : '') + 'DesiSmash Kitchen';
    $('kinfo').textContent = (nNew ? nNew + ' new · ' : '') + (nNote ? nNote + ' with notes · ' : '') + 'sorted by when to start cooking';
    const tot = (a) => money(a.reduce((s, x) => s + Number((x.o || x).total || 0), 0));
    if (!can('totals')) { $('s-todo').textContent = ''; $('s-cook').textContent = ''; $('s-ready').textContent = ''; }
    else {
    $('s-todo').textContent = todo.length ? tot(todo) : '';
    $('s-cook').textContent = cook.length ? tot(cook) : '';
    $('s-ready').textContent = ready.length ? tot(ready) : '';
    }
    $('n-todo').textContent = todo.length; $('n-cook').textContent = cook.length; $('n-ready').textContent = ready.length;
    $('l-todo').innerHTML = todo.length ? todo.map((x, i) => ticket(x.o, now, { kind: 'todo', next: i === 0 })).join('') : '<div class="empty">No orders waiting. Nice.</div>';
    $('l-cook').innerHTML = cook.length ? cook.map((o) => ticket(o, now, { kind: 'cook' })).join('') : '<div class="empty">Nothing on the grill.</div>';
    $('l-ready').innerHTML = ready.length ? ready.map((o) => ticket(o, now, { kind: 'ready' })).join('') : '<div class="empty">Nothing waiting for pickup.</div>';
    // cook list
    const need = {}; let paneer = 0, fries = 0, cans = 0, dips = 0;
    todo.map((x) => x.o).concat(cook).forEach((o) => (o.order_items || []).forEach((i) => {
      if (i.patties > 0) { const k = i.patty || 'Patty'; need[k] = (need[k] || 0) + i.patties * i.qty; }
      if (i.menu_item_id === 'paneer') paneer += i.qty;
      if (i.meal) { fries += i.qty; cans += i.qty; }
      if (['fries', 'naga-f', 'loaded'].includes(i.menu_item_id)) fries += i.qty;
      if (i.menu_item_id === 'can') cans += i.qty;
      if (i.menu_item_id === 'dip') dips += i.qty;
    }));
    const rows = Object.keys(need).sort().map((k) => '<div><span>' + esc(k) + ' patties</span><b>' + need[k] + '</b></div>');
    if (paneer) rows.push('<div><span>Paneer slabs</span><b>' + paneer + '</b></div>');
    if (fries) rows.push('<div><span>Fries portions</span><b>' + fries + '</b></div>');
    if (cans) rows.push('<div><span>Cans</span><b>' + cans + '</b></div>');
    if (dips) rows.push('<div><span>Dip pots</span><b>' + dips + '</b></div>');
    $('cooklist').innerHTML = rows.length ? rows.join('') : '<div class="empty">Nothing to cook.</div>';
  }
  function renderOrders() {
    const q = $('o-q').value.trim().toLowerCase(), today = dayKey(Date.now());
    let list = orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (ofilter === 'today') list = list.filter((o) => dayKey(o.slot_at) === today);
    if (ofilter === 'open') list = list.filter((o) => ['new', 'accepted', 'cooking', 'ready'].includes(o.status));
    if (q) list = list.filter((o) => (String(o.number) + ' ' + ((o.customers && o.customers.name) || '') + ' ' + ((o.customers && o.customers.phone) || '')).toLowerCase().includes(q));
    $('o-table').innerHTML = '<thead><tr><th>#</th><th>When</th><th>Customer</th><th>Mode</th><th>Items</th><th class="n">Total</th><th>Status</th></tr></thead><tbody>' +
      (list.length ? list.map((o) => '<tr><td><b>' + esc(o.number) + '</b></td><td>' + fmtD(o.slot_at) + '<br><span class="sub">' + fmtT(o.slot_at) + '</span></td><td>' + esc((o.customers || {}).name) + '<br><span class="sub">' + esc((o.customers || {}).phone) + '</span></td><td>' + esc(o.mode) + '</td><td>' +
        (o.order_items || []).map((i) => esc(i.qty) + '× ' + esc(i.name) + ((i.mods || []).length ? ' <span class="red">(' + esc(i.mods.join(', ')) + ')</span>' : '')).join('<br>') + '</td><td class="n">' + money(o.total) + '</td><td class="st-' + esc(o.status) + '">' + esc(o.status) + '</td></tr>').join('')
        : '<tr><td colspan="7" class="empty">No orders yet.</td></tr>') + '</tbody>';
  }
  let csort = { k: 'last_order_at', dir: -1 };
  function renderCustomers() {
    const q = $('c-q').value.trim().toLowerCase();
    let list = customers.filter((c) => (!mktOnly || c.marketing_consent) && (!q || ((c.name || '') + ' ' + (c.phone || '') + ' ' + (c.email || '')).toLowerCase().includes(q)));
    list.sort((a, b) => { const x = a[csort.k], y = b[csort.k]; return (x > y ? 1 : x < y ? -1 : 0) * csort.dir; });
    const th = (k, l, n) => '<th data-sort="' + k + '"' + (n ? ' class="n"' : '') + '>' + l + (csort.k === k ? (csort.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
    $('c-table').innerHTML = '<thead><tr>' + th('name', 'Name') + th('phone', 'Phone') + th('email', 'Email') + th('marketing_consent', 'Marketing') + th('orders', 'Orders', 1) + th('spent', 'Spent', 1) + th('last_order_at', 'Last order') + '</tr></thead><tbody>' +
      (list.length ? list.map((c) => '<tr class="click" data-c="' + esc(c.id) + '"><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.phone) + '</td><td>' + esc(c.email || '') + '</td><td><span class="pill ' + (c.marketing_consent ? 'yes' : '') + '">' + (c.marketing_consent ? 'Opted in' : 'No') + '</span></td><td class="n">' + esc(c.orders) + '</td><td class="n">' + money(c.spent) + '</td><td>' + (c.last_order_at ? fmtD(c.last_order_at) : '') + '</td></tr>').join('')
        : '<tr><td colspan="7" class="empty">No customers yet.</td></tr>') + '</tbody>';
    $('c-table')._list = list;
  }
  function render() {
    if (tab === 'kitchen') renderKitchen();
    if (tab === 'orders') renderOrders();
    if (tab === 'customers') renderCustomers();
    if (tab === 'cash') renderCash();
  }
  function tick() { $('clock').textContent = fmtT(Date.now()); if (tab === 'kitchen') renderKitchen(); }
  setInterval(() => { if (!$('app').hidden) tick(); }, 15000);

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) {
      tab = t.dataset.tab;
      document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      ['kitchen', 'orders', 'customers', 'cash', 'team'].forEach((n) => { $('v-' + n).hidden = n !== tab; });
      if (tab === 'cash') { loadCashup(); return; }
      if (tab === 'team') { loadTeam(); return; }
      render(); return;
    }
    const a = e.target.closest('[data-a]');
    if (a) { setStatus(a.dataset.id, a.dataset.a, false, a.dataset.pay || null); return; }
    const mfb = e.target.closest('[data-mf]');
    if (mfb) { mf = mfb.dataset.mf; document.querySelectorAll('[data-mf]').forEach((x) => x.setAttribute('aria-pressed', String(x === mfb))); renderKitchen(); return; }
    const f = e.target.closest('[data-of]');
    if (f) { ofilter = f.dataset.of; renderOrders(); return; }
    const s = e.target.closest('th[data-sort]');
    if (s) { const k = s.dataset.sort; csort = { k, dir: csort.k === k ? -csort.dir : 1 }; renderCustomers(); return; }
    const row = e.target.closest('tr[data-c]');
    if (row) { openCustomer(row.dataset.c); return; }
    if (e.target.id === 'drawer-x') $('drawer').hidden = true;
  });
  let zoom = 1;
  try { zoom = parseFloat(localStorage.getItem('ds-zoom')) || 1; } catch (e) { /* storage unavailable */ }
  const applyZoom = () => { document.documentElement.style.setProperty('--z', zoom); try { localStorage.setItem('ds-zoom', zoom); } catch (e) { /* optional */ } };
  applyZoom();
  $('zp').addEventListener('click', () => { zoom = Math.min(1.5, +(zoom + 0.1).toFixed(1)); applyZoom(); });
  $('zm').addEventListener('click', () => { zoom = Math.max(0.8, +(zoom - 0.1).toFixed(1)); applyZoom(); });
  $('o-q').addEventListener('input', renderOrders);
  $('c-q').addEventListener('input', renderCustomers);
  $('c-mkt').addEventListener('click', (e) => { mktOnly = !mktOnly; e.target.setAttribute('aria-pressed', String(mktOnly)); e.target.classList.toggle('p', mktOnly); renderCustomers(); });
  $('sound').addEventListener('click', (e) => { soundOn = !soundOn; e.target.setAttribute('aria-pressed', String(soundOn)); e.target.textContent = soundOn ? 'Sound on' : 'Sound off'; if (soundOn) beep(); });

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175, 880].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.22); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
        o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.21);
      });
    } catch (e) { /* audio blocked */ }
  }

  /* ---------- customer drawer ---------- */
  function openCustomer(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    const hist = orders.filter((o) => o.customer_id === id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const dr = $('drawer');
    dr.hidden = false;
    dr.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><h2>' + esc(c.name) + '</h2><button class="btn sm" id="drawer-x">Close</button></div>' +
      '<div class="sub">' + esc(c.phone) + (c.email ? ' · ' + esc(c.email) : '') + '</div>' +
      '<div><span class="pill ' + (c.marketing_consent ? 'yes' : '') + '">' + (c.marketing_consent ? 'Marketing: opted in ' + (c.marketing_consent_at ? fmtD(c.marketing_consent_at) : '') : 'No marketing consent') + '</span></div>' +
      '<div class="cl"><div><span>Orders</span><b>' + esc(c.orders) + '</b></div><div><span>Total spent</span><b>' + money(c.spent) + '</b></div><div><span>Average order</span><b>' + money(c.orders ? c.spent / c.orders : 0) + '</b></div></div>' +
      '<label class="sub">Notes (allergies, preferences)<input id="c-notes" value="' + esc(c.notes || '') + '"></label>' +
      '<button class="btn p sm" id="c-save">Save note</button>' +
      '<h3>Order history</h3><div class="hist">' + (hist.length ? hist.map((o) => '<div class="h"><b>#' + esc(o.number) + '</b> · ' + fmtD(o.slot_at) + ' · ' + money(o.total) + ' · <span class="st-' + esc(o.status) + '">' + esc(o.status) + '</span><br><span class="sub">' + (o.order_items || []).map((i) => esc(i.qty) + '× ' + esc(i.name)).join(', ') + '</span></div>').join('') : '<div class="empty">Only the last 60 days are loaded.</div>') + '</div>';
    $('c-save').onclick = async () => {
      const { error } = await sb.from('customers').update({ notes: $('c-notes').value.trim() || null }).eq('id', id);
      toast(error ? 'Could not save' : 'Saved'); if (!error) loadAll();
    };
  }

  /* ---------- exports ---------- */
  function csv(rows) {
    return rows.map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  $('c-csv').addEventListener('click', () => {
    const list = $('c-table')._list || customers;
    download('desismash-customers.csv', csv([['Name', 'Phone', 'Email', 'Marketing consent', 'Consent date', 'Orders', 'Spent', 'First order', 'Last order', 'Notes']].concat(
      list.map((c) => [c.name, c.phone, c.email, c.marketing_consent ? 'yes' : 'no', c.marketing_consent_at || '', c.orders, Number(c.spent).toFixed(2), c.first_order_at || '', c.last_order_at || '', c.notes || '']))));
  });
  $('o-csv').addEventListener('click', () => {
    download('desismash-orders.csv', csv([['Order', 'Created', 'Slot', 'Customer', 'Phone', 'Mode', 'Postcode', 'Items', 'Subtotal', 'Delivery', 'Total', 'Status', 'Notes']].concat(
      orders.map((o) => [o.number, o.created_at, o.slot_at, (o.customers || {}).name, (o.customers || {}).phone, o.mode, o.postcode || '', (o.order_items || []).map((i) => i.qty + 'x ' + i.name + ((i.mods || []).length ? ' (' + i.mods.join(', ') + ')' : '')).join('; '), o.subtotal, o.delivery_fee, o.total, o.status, o.notes || '']))));
  });
  $('c-mails').addEventListener('click', async () => {
    const mails = customers.filter((c) => c.marketing_consent && c.email).map((c) => c.email).join(', ');
    try { await navigator.clipboard.writeText(mails); toast(mails ? 'Copied ' + mails.split(',').length + ' emails' : 'No opted-in emails yet'); } catch (e) { toast('Could not copy'); }
  });


  /* ---------- cash up / end of shift ---------- */
  let cuDay = dayKey(Date.now()), cuSaved = null, cuTyped = { float: '', counted: '', terminal: '', notes: '' };
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  async function loadCashup() {
    const r = await sb.from('cash_ups').select('*').eq('day', cuDay);
    cuSaved = (r.data && r.data[0]) || null;
    if (cuSaved) cuTyped = { float: String(cuSaved.opening_float ?? ''), counted: cuSaved.counted_cash == null ? '' : String(cuSaved.counted_cash), terminal: cuSaved.card_terminal_total == null ? '' : String(cuSaved.card_terminal_total), notes: cuSaved.notes || '' };
    else cuTyped = { float: cuTyped.float || '', counted: '', terminal: '', notes: '' };
    renderCash();
  }
  function dayStats() {
    const dayOrders = orders.filter((o) => dayKey(o.slot_at) === cuDay);
    const done = dayOrders.filter((o) => o.status === 'done');
    const open = dayOrders.filter((o) => ['new', 'accepted', 'cooking', 'ready'].includes(o.status));
    const cancelled = dayOrders.filter((o) => o.status === 'cancelled');
    const total = (a) => a.reduce((s, o) => s + Number(o.total || 0), 0);
    const cash = done.filter((o) => o.payment_method === 'cash'), card = done.filter((o) => o.payment_method === 'card');
    const unrec = done.filter((o) => o.payment_method !== 'cash' && o.payment_method !== 'card');
    const sold = {};
    done.forEach((o) => (o.order_items || []).forEach((i) => { sold[i.name] = (sold[i.name] || 0) + i.qty; }));
    return {
      done, open, cancelled, unrec,
      gross: total(done), cash: total(cash), card: total(card), unrecorded: total(unrec),
      fees: done.reduce((s, o) => s + Number(o.delivery_fee || 0), 0),
      coll: total(done.filter((o) => o.mode === 'Collection')), deliv: total(done.filter((o) => o.mode === 'Delivery')),
      nColl: done.filter((o) => o.mode === 'Collection').length, nDeliv: done.filter((o) => o.mode === 'Delivery').length,
      openValue: total(open), sold: Object.entries(sold).sort((a, b) => b[1] - a[1])
    };
  }
  function renderCash() {
    const s = dayStats();
    const avg = s.done.length ? s.gross / s.done.length : 0;
    const dlabel = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(cuDay + 'T12:00:00Z'));
    $('cash').innerHTML =
      '<div class="cash-top"><button class="btn sm" id="cu-prev">◀</button><input type="date" id="cu-date" value="' + cuDay + '"><button class="btn sm" id="cu-next">▶</button><button class="btn sm" id="cu-today">Today</button><span class="sub">' + esc(dlabel) + '</span><span class="grow"></span>' +
      (cuSaved ? '<span class="pill yes">Saved ' + fmtT(cuSaved.closed_at) + '</span>' : '<span class="pill">Not saved yet</span>') + '</div>' +
      '<div class="bigtotal"><div><div class="lbl">Total takings</div><div class="big">' + money(s.gross) + '</div></div>' +
      '<div class="stat"><span class="lbl">Orders</span><b>' + s.done.length + '</b></div><div class="stat"><span class="lbl">Average order</span><b>' + money(avg) + '</b></div>' +
      '<div class="stat"><span class="lbl">Cancelled</span><b>' + s.cancelled.length + '</b></div></div>' +
      (s.open.length ? '<div class="note"><span class="tag">Open</span><span>' + s.open.length + ' order' + (s.open.length > 1 ? 's' : '') + ' not finished yet (' + money(s.openValue) + '). They are not in the totals until handed over.</span></div>' : '') +
      '<div class="grid2">' +
        '<div class="panelx"><h3>How it was paid</h3>' +
          '<div class="kv"><span>Cash</span><b>' + money(s.cash) + '</b></div><div class="kv"><span>Card</span><b>' + money(s.card) + '</b></div>' +
          '<div class="kv"><span>Not recorded</span><b class="' + (s.unrecorded > 0 ? 'warn' : '') + '">' + money(s.unrecorded) + '</b></div></div>' +
        '<div class="panelx"><h3>Collection and delivery</h3>' +
          '<div class="kv"><span>Collection (' + s.nColl + ')</span><b>' + money(s.coll) + '</b></div><div class="kv"><span>Delivery (' + s.nDeliv + ')</span><b>' + money(s.deliv) + '</b></div>' +
          '<div class="kv"><span>of which delivery fees</span><b>' + money(s.fees) + '</b></div></div>' +
        '<div class="panelx"><h3>Cash drawer</h3>' +
          '<label class="fld">Opening float (£)<input id="cu-float" inputmode="decimal" value="' + esc(cuTyped.float) + '" placeholder="0.00"></label>' +
          '<label class="fld">Cash counted at close (£)<input id="cu-counted" inputmode="decimal" value="' + esc(cuTyped.counted) + '" placeholder="0.00"></label>' +
          '<div class="kv"><span>Expected in drawer</span><b id="cu-exp">£0.00</b></div><div class="kv big"><span>Over / short</span><b id="cu-var">–</b></div>' +
          '<div class="kv big"><span>Cash to bank</span><b id="cu-bank">–</b></div></div>' +
        '<div class="panelx"><h3>Card terminal</h3>' +
          '<label class="fld">Terminal total for the day (£)<input id="cu-term" inputmode="decimal" value="' + esc(cuTyped.terminal) + '" placeholder="From SumUp / Zettle report"></label>' +
          '<div class="kv"><span>Card sales recorded here</span><b>' + money(s.card) + '</b></div><div class="kv big"><span>Difference</span><b id="cu-tvar">–</b></div></div>' +
      '</div>' +
      (s.unrec.length ? '<div class="panelx"><h3>Fix payments not recorded (' + s.unrec.length + ')</h3>' + s.unrec.map((o) => '<div class="fix"><span><b>#' + esc(o.number) + '</b> ' + esc((o.customers || {}).name) + ' · ' + money(o.total) + '</span><span class="btns2" style="width:auto"><button class="btn sm b" data-fixpay="card" data-id="' + esc(o.id) + '">Card</button><button class="btn sm g" data-fixpay="cash" data-id="' + esc(o.id) + '">Cash</button></span></div>').join('') + '</div>' : '') +
      '<div class="grid2"><div class="panelx"><h3>What sold</h3>' + (s.sold.length ? s.sold.slice(0, 12).map(([n, q]) => '<div class="kv"><span>' + esc(n) + '</span><b>' + q + '</b></div>').join('') : '<div class="empty">No finished orders yet.</div>') + '</div>' +
      '<div class="panelx"><h3>Notes</h3><label class="fld">Anything to remember about this shift<input id="cu-notes" value="' + esc(cuTyped.notes) + '" placeholder="e.g. ran out of brioche at 9pm"></label>' +
      '<div class="btns2"><button class="btn p" id="cu-save">Save cash up</button><button class="btn" id="cu-csv">Export day CSV</button></div></div></div>';
    recalcCash();
  }
  function recalcCash() {
    if (!$('cu-float')) return;
    const s = dayStats();
    cuTyped.float = $('cu-float').value; cuTyped.counted = $('cu-counted').value; cuTyped.terminal = $('cu-term').value; cuTyped.notes = $('cu-notes').value;
    const exp = num(cuTyped.float) + s.cash;
    $('cu-exp').textContent = money(exp);
    const v = $('cu-var'), bank = $('cu-bank'), tv = $('cu-tvar');
    if (cuTyped.counted.trim() === '') { v.textContent = '–'; v.className = ''; bank.textContent = '–'; }
    else {
      const diff = num(cuTyped.counted) - exp;
      v.textContent = (diff > 0 ? '+' : diff < 0 ? '−' : '') + money(Math.abs(diff));
      v.className = Math.abs(diff) < 0.005 ? 'ok' : 'bad';
      bank.textContent = money(Math.max(0, num(cuTyped.counted) - num(cuTyped.float)));
    }
    if (cuTyped.terminal.trim() === '') { tv.textContent = '–'; tv.className = ''; }
    else { const d = num(cuTyped.terminal) - s.card; tv.textContent = (d > 0 ? '+' : d < 0 ? '−' : '') + money(Math.abs(d)); tv.className = Math.abs(d) < 0.005 ? 'ok' : 'bad'; }
  }
  async function saveCashup() {
    const s = dayStats();
    const u = await sb.auth.getUser();
    const row = {
      day: cuDay, opening_float: num(cuTyped.float), counted_cash: cuTyped.counted.trim() === '' ? null : num(cuTyped.counted),
      card_terminal_total: cuTyped.terminal.trim() === '' ? null : num(cuTyped.terminal), notes: cuTyped.notes.trim() || null,
      closed_at: new Date().toISOString(), closed_by: (u.data && u.data.user && u.data.user.email) || null,
      snapshot: { gross: s.gross, cash: s.cash, card: s.card, unrecorded: s.unrecorded, orders: s.done.length, cancelled: s.cancelled.length, delivery_fees: s.fees, collection: s.coll, delivery: s.deliv }
    };
    const { error } = await sb.from('cash_ups').upsert(row, { onConflict: 'day' });
    if (error) { toast('Could not save: ' + error.message); return; }
    cuSaved = row; toast('Cash up saved for ' + cuDay); renderCash();
  }
  document.addEventListener('input', (e) => { if (e.target.id && e.target.id.indexOf('cu-') === 0 && e.target.id !== 'cu-date') recalcCash(); });
  document.addEventListener('click', (e) => {
    const t = e.target;
    const shift = (n) => { const d = new Date(cuDay + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); cuDay = d.toISOString().slice(0, 10); loadCashup(); };
    if (t.id === 'cu-prev') shift(-1);
    else if (t.id === 'cu-next') shift(1);
    else if (t.id === 'cu-today') { cuDay = dayKey(Date.now()); loadCashup(); }
    else if (t.id === 'cu-save') saveCashup();
    else if (t.id === 'cu-csv') {
      const list = orders.filter((o) => dayKey(o.slot_at) === cuDay);
      download('desismash-' + cuDay + '.csv', csv([['Order', 'Time', 'Customer', 'Mode', 'Status', 'Payment', 'Subtotal', 'Delivery', 'Total']].concat(
        list.map((o) => [o.number, fmtT(o.slot_at), (o.customers || {}).name, o.mode, o.status, o.payment_method, o.subtotal, o.delivery_fee, o.total]))));
    } else if (t.dataset && t.dataset.fixpay) {
      sb.rpc('set_order_payment', { p_id: t.dataset.id, p_payment: t.dataset.fixpay }).then((r) => {
        if (r && r.error) toast('Could not update'); else { const o = orders.find((x) => x.id === t.dataset.id); if (o) o.payment_method = t.dataset.fixpay; renderCash(); loadAll(); }
      });
    }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'cu-date' && e.target.value) { cuDay = e.target.value; loadCashup(); } });


  /* ---------- team (owner only) ---------- */
  const ROLE_HELP = {
    owner: 'Everything, including the team list',
    manager: 'Orders, customers, cash up, delivery switch',
    counter: 'Kitchen board with order values, takes payments. No customer list, history or cash up',
    kitchen: 'Tickets only: no prices, no phone numbers, no takings',
    driver: 'Delivery tickets only, with address and phone while on the job'
  };
  async function loadTeam() {
    const r = await sb.from('staff').select('email,role,created_at').order('created_at');
    staffRows = r.data || [];
    renderTeam();
  }
  function renderTeam() {
    const opts = (sel) => Object.keys(ROLE_LABEL).map((x) => '<option value="' + x + '"' + (x === sel ? ' selected' : '') + '>' + ROLE_LABEL[x] + '</option>').join('');
    $('team').innerHTML = '<div class="panelx"><h3>Team</h3><p class="hint">Each person signs in with their own email. They create an account on the sign-in page, then you add their email here with a role.</p>' +
      staffRows.map((s) => '<div class="fix"><span><b>' + esc(s.email) + '</b><br><span class="hint">' + esc(ROLE_HELP[s.role] || '') + '</span></span>' +
        '<span class="btns2" style="width:auto"><select data-staffrole="' + esc(s.email) + '" style="width:auto">' + opts(s.role) + '</select><button class="btn sm r" data-rmstaff="' + esc(s.email) + '">Remove</button></span></div>').join('') + '</div>' +
      '<div class="panelx"><h3>Add someone</h3><label class="fld">Email<input id="tm-email" type="email" placeholder="name@example.com"></label>' +
      '<label class="fld">Role<select id="tm-role">' + opts('kitchen') + '</select></label>' +
      '<button class="btn p" id="tm-add">Add to team</button></div>';
  }
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.id === 'tm-add') {
      const email = $('tm-email').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('Enter a valid email'); return; }
      const { error } = await sb.from('staff').insert({ email, role: $('tm-role').value });
      toast(error ? 'Could not add: ' + error.message : 'Added ' + email); loadTeam();
    } else if (t.dataset && t.dataset.rmstaff) {
      const { error } = await sb.from('staff').delete().eq('email', t.dataset.rmstaff);
      toast(error ? error.message : 'Removed'); loadTeam();
    }
  });
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.staffrole) {
      const { error } = await sb.from('staff').update({ role: t.value }).eq('email', t.dataset.staffrole);
      toast(error ? error.message : 'Role updated'); loadTeam();
    }
  });

  sb.auth.onAuthStateChange(() => {});
  enter();
})();
