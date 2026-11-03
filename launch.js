/* Coming-soon notice for pages that do not run app.js (the guides). Settings live in config.js, under launch. */
(function () {
  var C = window.DESI || {}, L = C.launch;
  if (!L || !L.on || !(Date.parse(L.at) > Date.now())) return;
  var bar = document.createElement('div');
  bar.className = 'announce';
  bar.appendChild(document.createTextNode('Coming soon. Ordering opens ' + (L.label || 'soon') + '. '));
  if (C.whatsapp) {
    var a = document.createElement('a');
    a.href = 'https://wa.me/' + String(C.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent('Hi Chef Hass, add me to the DesiSmash drop list');
    a.textContent = 'Join the drop list';
    a.target = '_blank'; a.rel = 'noopener';
    a.style.color = '#fff'; a.style.textDecoration = 'underline';
    bar.appendChild(a);
  }
  document.body.insertBefore(bar, document.body.firstChild);
  document.querySelectorAll('a.pill.order, .gcta a.pill.solid').forEach(function (el) {
    if (/^order now$/i.test(el.textContent.trim())) el.textContent = el.classList.contains('order') ? 'See menu' : 'See the menu';
  });
})();
