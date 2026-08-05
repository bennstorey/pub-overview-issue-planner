  // ─── DOM helper ────────────────────────────────────────────────────────────
  // Shared by the grid and the dialog, so it lives ahead of both.

  // Studio returns datetimes in the *server's* timezone with no offset marker,
  // and that timezone is not necessarily the viewer's or even UTC — this server
  // records UTC-4 while the browser sits in BST, so a plan saved at 06:49 local
  // reads 01:49. Rendering it as if it were local time is worse than not
  // converting, so show it verbatim and say whose clock it is.
  function serverTime(value) {
    var s = String(value || '').trim();
    if (!s) return 'unknown time';
    return s.slice(0, 16).replace('T', ' ') + ' server time';
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'text') node.textContent = props[k];
      else if (k === 'class') node.className = props[k];
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
