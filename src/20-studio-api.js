  // ─── Studio Server API (same origin — cookie session) ─────────────────────
  // Requests authenticate via the session cookie plus the X-WoodWing-Application
  // header (CSRF guard), with Ticket null in the payload. On older ticket-based
  // setups getInfo().Ticket is populated and used instead. Proven against
  // lab-studio for both index.php (workflow) and editorialplan.php (planning) —
  // the planning endpoint accepting this session is what makes a plug-in viable
  // at all; see research/planning-api-and-ids-jobs.md.
  var WW_APP = 'Content Station';
  var WW_APP_HEADER = { 'X-WoodWing-Application': WW_APP };

  function getTicket() {
    try {
      var info = ContentStationSdk.getInfo();
      return (info && info.Ticket) || '';
    } catch (e) { return ''; }
  }

  // The PO iframe lives at /app/publicationoverview/, so host-absolute paths are
  // the safe default; csConfig is used when it is exposed in this frame.
  function serverUrl(script) {
    var base = (window.csConfig && window.csConfig.serverUrl) || '/server/index.php';
    var rel = base.replace(/[^/]+$/, script);
    return new URL(rel, window.location.href).href;
  }

  function rpc(script, method, params) {
    params = params || {};
    if (!('Ticket' in params) || !params.Ticket) params.Ticket = getTicket() || null;
    return fetch(serverUrl(script) + '?protocol=JSON&method=' + encodeURIComponent(method), {
      method: 'POST',
      credentials: 'same-origin',
      headers: Object.assign({ 'Content-Type': 'application/json' }, WW_APP_HEADER),
      body: JSON.stringify({ method: method, id: '1', params: [params], jsonrpc: '2.0' }),
    }).then(function (r) {
      if (!r.ok) throw new Error(method + ' failed: HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j.error) {
        console.error(TAG + ' ' + method + ' error response:', j.error);
        var e = j.error;
        var parts = [];
        if (e.message) parts.push(e.message);
        if (e.data && e.data.detail && e.data.detail !== e.message) parts.push(e.data.detail);
        if (e.code) parts.push('(code ' + e.code + ')');
        throw new Error(method + ' failed: ' + (parts.join(' — ') || JSON.stringify(e)));
      }
      return j.result;
    });
  }

  function callServer(method, params) { return rpc('index.php', method, params); }
  function callPlanning(method, params) { return rpc('editorialplan.php', method, params); }

  function notify(content, type) {
    try {
      ContentStationSdk.showNotification({ content: content, type: type || 'default', timeout: 6000, showX: true });
    } catch (e) {
      console.info(TAG + ' ' + content);
    }
  }

  function currentFilter() {
    try { return PoUiSdk.currentFilterSetting() || {}; } catch (e) { return {}; }
  }
