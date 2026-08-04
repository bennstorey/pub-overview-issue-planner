  // ─── Defaults ──────────────────────────────────────────────────────────────
  // Naming pattern tokens: {issue} {brand} {template} {page} {pageend}
  // {pagerange}. Page tokens take :0N zero-padding, e.g. {page:03} -> 007.
  var DEFAULTS = {
    layoutPattern: '{brand}_p{page:03}_{template}',
    // Left null until a brand nominates one; empty slots are skipped without it.
    defaultTemplateId: null,
    // Anything whose name contains this is offered as the blank-page template.
    blankTemplateHint: 'blank',
  };

  var SETTINGS_KEY = 'issueCreator.settings';

  function loadSettings() {
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      return raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveSettings(s) {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn(TAG + ' could not persist settings: ' + e.message);
    }
  }
