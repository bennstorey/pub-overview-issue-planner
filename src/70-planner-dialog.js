  // ─── Planner dialog ────────────────────────────────────────────────────────
  // Hosts the slot grid and the template list. Context comes from the current
  // Publication Overview filter, so the dialog never asks which issue you mean.

  var DIALOG_CSS = [
    '.ic-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center}',
    '.ic-dialog{background:#fff;color:#222;border-radius:6px;width:1040px;max-width:94vw;height:80vh;',
    '  display:flex;flex-direction:column;font:13px/1.5 system-ui,sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.35)}',
    '.ic-dialog h2{margin:0;padding:12px 18px;border-bottom:1px solid #e3e3e3;font-size:15px;font-weight:600;',
    '  display:flex;align-items:baseline;gap:10px}',
    '.ic-ctx{font-weight:400;font-size:12px;color:#666}',
    '.ic-main{flex:1;display:flex;min-height:0}',
    '.ic-left{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid #e3e3e3}',
    '.ic-toolbar{padding:8px 14px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.ic-toolbar input[type=number]{width:64px;padding:3px 6px;border:1px solid #ccc;border-radius:3px}',
    '.ic-toolbar input[type=text]{flex:1;min-width:150px;padding:3px 6px;border:1px solid #ccc;border-radius:3px;font-family:ui-monospace,monospace;font-size:12px}',
    '.ic-grid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));',
    '  gap:10px;padding:14px;align-content:start}',
    '.ic-slot{position:relative;border:2px dashed #ccc;border-radius:6px;padding:6px;cursor:pointer;text-align:center;background:#fafafa}',
    '.ic-slot.ic-filled{border-style:solid;border-color:#9aa0a6;background:#fff}',
    '.ic-slot.ic-selected{border-color:#1a73e8;box-shadow:0 0 0 2px rgba(26,115,232,.3)}',
    '.ic-slot.ic-existing{border-style:solid;border-color:#2f7d4f;background:#f2f8f4;cursor:default;opacity:.85}',
    '.ic-slot.ic-existing .ic-slot-thumb{filter:grayscale(35%)}',
    '.ic-slot-thumb{height:96px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:4px;overflow:hidden}',
    '.ic-slot-thumb img{max-width:100%;max-height:100%}',
    // One preview per page across a spread, since an object thumb only shows
    // its first spread.
    '.ic-page-strip{display:flex;gap:2px;height:100%;width:100%;align-items:center;justify-content:center}',
    '.ic-page-strip img{max-height:100%;min-width:0;object-fit:contain;flex:0 1 auto}',
    '.ic-slot-empty{color:#999;font-size:11px}',
    '.ic-slot-page{font-weight:700;font-size:11px;margin-top:5px;display:flex;gap:4px;justify-content:center;align-items:center;flex-wrap:wrap}',
    '.ic-badge{font-weight:600;font-size:9px;background:#e8eaed;color:#444;border-radius:8px;padding:1px 6px}',
    '.ic-badge-existing{background:#d7eade;color:#1d6b3d}',
    '.ic-slot-tpl{font-size:10px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ic-slot-clear{position:absolute;top:3px;right:3px;width:19px;height:19px;padding:0;line-height:1;',
    '  border-radius:50%;border:1px solid #ccc;background:#fff;cursor:pointer;font-size:12px}',
    '.ic-slot-include{position:absolute;top:5px;left:5px;margin:0;cursor:pointer}',
    '.ic-slot.ic-excluded{opacity:.45}',
    '.ic-slot.ic-excluded .ic-slot-thumb{filter:grayscale(80%)}',
    '.ic-slot.ic-drop{border-color:#1a73e8;border-style:dashed;background:#e8f0fe}',
    '.ic-slot[draggable=true]{cursor:grab}',
    '.ic-sep{border-left:1px solid #ddd;height:16px;display:inline-block}',
    '.ic-toolbar button{padding:3px 9px;border-radius:3px;border:1px solid #ccc;background:#f6f6f6;cursor:pointer;font-size:12px}',
    '.ic-load{max-width:260px;padding:3px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px}',
    '.ic-right{width:280px;display:flex;flex-direction:column;min-height:0}',
    '.ic-right h3{margin:0;padding:10px 14px;font-size:12px;font-weight:600;color:#555;border-bottom:1px solid #eee}',
    '.ic-templates{flex:1;overflow-y:auto;padding:6px}',
    '.ic-tpl{display:flex;gap:8px;align-items:center;padding:6px;border-radius:4px;cursor:pointer;border:1px solid transparent}',
    '.ic-tpl:hover{background:#f1f3f4;border-color:#dadce0}',
    '.ic-tpl-thumb{width:38px;height:44px;flex:none;background:#eee;border-radius:3px;display:flex;align-items:center;justify-content:center;overflow:hidden}',
    '.ic-tpl-thumb img{max-width:100%;max-height:100%}',
    '.ic-tpl-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ic-tpl-meta{font-size:10px;color:#888}',
    '.ic-status{padding:8px 18px;border-top:1px solid #e3e3e3;font-size:12px;color:#555;min-height:19px}',
    '.ic-actions{padding:10px 18px;border-top:1px solid #e3e3e3;display:flex;justify-content:space-between;align-items:center;gap:8px}',
    '.ic-actions button{padding:6px 14px;border-radius:4px;border:1px solid #bbb;background:#f6f6f6;cursor:pointer}',
    '.ic-actions button.ic-primary{background:#1a73e8;border-color:#1a73e8;color:#fff}',
    '.ic-actions button[disabled]{opacity:.5;cursor:default}',
    '.ic-muted{color:#777}.ic-ok{color:#137333}.ic-bad{color:#c5221f}',
  ].join('\n');

  function injectCss() {
    if (document.getElementById('ic-styles')) return;
    var style = document.createElement('style');
    style.id = 'ic-styles';
    style.textContent = DIALOG_CSS;
    document.head.appendChild(style);
  }

  function openPlannerDialog() {
    injectCss();
    var filter = currentFilter();
    if (!filter.issueId) {
      notify('Open an issue in Publication Overview first.', 'error');
      return;
    }
    // The filter's key names are undocumented and not all are what the notes
    // suggest — log the raw object so a wrong assumption is visible, not silent.
    console.info(TAG + ' currentFilterSetting():', filter);

    var settings = loadSettings();
    var state = { ctx: null, templates: [], model: null, blank: null, busy: false, pageCountTouched: false };

    var ctxLine = el('span', { class: 'ic-ctx', text: 'resolving…' });
    var pageCount = el('input', { type: 'number', min: '1', max: '999', value: '16' });
    var patternInput = el('input', { type: 'text', value: settings.layoutPattern, title: 'Naming pattern' });
    var rebuildBtn = el('button', { text: 'Rebuild grid' });
    var gridBox = el('div', { class: 'ic-grid' });
    var templateBox = el('div', { class: 'ic-templates', text: 'Loading…' });
    var statusLine = el('div', { class: 'ic-status ic-muted', text: '' });
    var countLine = el('div', { class: 'ic-muted', text: '' });

    var allBtn = el('button', { text: 'All', title: 'Include every page in the next run' });
    var noneBtn = el('button', { text: 'None', title: 'Exclude every page from the next run' });
    var savePlanBtn = el('button', { text: 'Save plan', title: 'Save this issue as work in progress, creating nothing' });
    var saveTplBtn = el('button', { text: 'Save as template…', title: 'Save this arrangement for reuse on other issues' });
    var loadSelect = el('select', { class: 'ic-load', title: 'Load a saved arrangement' });

    var closeBtn = el('button', { text: 'Close' });
    var createBtn = el('button', { class: 'ic-primary', text: 'Create pages' });
    createBtn.disabled = true;

    var dialog = el('div', { class: 'ic-dialog' }, [
      el('h2', {}, [el('span', { text: 'Issue Creator' }), ctxLine]),
      el('div', { class: 'ic-main' }, [
        el('div', { class: 'ic-left' }, [
          el('div', { class: 'ic-toolbar' }, [
            el('span', { class: 'ic-muted', text: 'Pages' }), pageCount, rebuildBtn,
            el('span', { class: 'ic-sep' }), el('span', { class: 'ic-muted', text: 'Select' }), allBtn, noneBtn,
            el('span', { class: 'ic-sep' }), el('span', { class: 'ic-muted', text: 'Name' }), patternInput,
          ]),
          el('div', { class: 'ic-toolbar' }, [
            savePlanBtn, saveTplBtn,
            el('span', { class: 'ic-sep' }), el('span', { class: 'ic-muted', text: 'Load' }), loadSelect,
          ]),
          gridBox,
        ]),
        el('div', { class: 'ic-right' }, [
          el('h3', { text: 'Templates — click a page, then a template' }),
          templateBox,
        ]),
      ]),
      statusLine,
      el('div', { class: 'ic-actions' }, [countLine, el('span', {}, [closeBtn, createBtn])]),
    ]);
    var overlay = el('div', { class: 'ic-overlay' }, [dialog]);
    document.body.appendChild(overlay);

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    closeBtn.addEventListener('click', function () { if (!state.busy) close(); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay && !state.busy) close(); });

    function setStatus(msg, kind) {
      statusLine.className = 'ic-status ' + (kind === 'error' ? 'ic-bad' : kind === 'ok' ? 'ic-ok' : 'ic-muted');
      statusLine.textContent = msg || '';
    }

    function refresh() {
      renderGrid(gridBox);
      var c = gridCounts();
      var willCreate = plannedSlots(state.blank).length;
      countLine.textContent = c.assigned + ' assigned · ' + c.empty + ' empty · ' +
        c.existing + ' already in issue' +
        (c.excluded ? ' · ' + c.excluded + ' deselected' : '') +
        (state.blank ? ' · empty pages get "' + state.blank.name + '"' : ' · empty pages skipped');
      createBtn.textContent = willCreate ? 'Create ' + willCreate + ' page' + (willCreate === 1 ? '' : 's') : 'Create pages';
      createBtn.disabled = state.busy || !willCreate || !state.ctx;
    }
    grid.onChange = refresh;
    grid.onError = function (msg) { setStatus(msg, 'error'); };

    allBtn.addEventListener('click', function () { setAllIncluded(true); refresh(); });
    noneBtn.addEventListener('click', function () { setAllIncluded(false); refresh(); });

    function rebuild() {
      var n = Math.max(1, Math.min(999, Number(pageCount.value) || 1));
      buildSlots(1, n);
      if (state.model) {
        var locked = overlayExisting(state.model);
        if (locked) setStatus(locked + ' layout(s) already in this issue are locked.');
      }
      refresh();
    }
    rebuildBtn.addEventListener('click', rebuild);
    pageCount.addEventListener('input', function () { state.pageCountTouched = true; });

    function renderTemplates() {
      templateBox.textContent = '';
      if (!state.templates.length) {
        templateBox.appendChild(el('div', { class: 'ic-muted', text: 'No layout templates in this brand.' }));
        return;
      }
      state.templates.forEach(function (t) {
        var thumb = el('div', { class: 'ic-tpl-thumb' });
        var perPage = t.pageCount > 1 ? pageThumbUrls(t.id) : null;
        var url = thumbUrl(t.id);
        if (perPage && perPage.length) {
          var strip = el('div', { class: 'ic-page-strip' });
          perPage.forEach(function (u) { strip.appendChild(el('img', { src: u, alt: '' })); });
          thumb.appendChild(strip);
        } else if (url) {
          thumb.appendChild(el('img', { src: url, alt: '' }));
        }
        var row = el('div', { class: 'ic-tpl', title: t.name }, [
          thumb,
          el('div', {}, [
            el('div', { class: 'ic-tpl-name', text: t.name }),
            el('div', {
              class: 'ic-tpl-meta',
              text: t.pageCount + 'pp' + (t.category ? ' · ' + t.category : '') +
                (state.blank && state.blank.id === t.id ? ' · blank' : ''),
            }),
          ]),
        ]);
        row.addEventListener('click', function () {
          var err = assignTemplate(t);
          if (err) setStatus(err, 'error'); else setStatus('');
          refresh();
        });
        templateBox.appendChild(row);
      });
    }

    // ── saving and loading arrangements ──

    function arrangementPayload() {
      var a = serializeArrangement();
      a.layoutPattern = patternInput.value;
      a.blankTemplateId = state.blank ? state.blank.id : null;
      a.savedAt = new Date().toISOString();
      return a;
    }

    function refreshLoadList() {
      if (!state.ctx) return Promise.resolve();
      return Promise.all([
        listIssueTemplates(state.ctx.publicationId).catch(function () { return []; }),
        listPlanVersions(state.ctx.publicationId, filter.issueId).catch(function () { return []; }),
      ]).then(function (r) {
        state.savedTemplates = r[0];
        state.versions = r[1];
        loadSelect.textContent = '';
        loadSelect.appendChild(el('option', { value: '', text: '— load —' }));
        state.versions.forEach(function (v, idx) {
          loadSelect.appendChild(el('option', {
            value: 'plan:' + v.id,
            text: 'Plan ' + (v.legacy ? '(before versioning)' : 'v' + v.version) +
              (v.date ? ' · ' + v.date : '') +
              (v.savedBy ? ' · ' + v.savedBy : '') +
              (idx === 0 && !v.legacy ? ' · latest' : ''),
          }));
        });
        state.savedTemplates.forEach(function (t) {
          loadSelect.appendChild(el('option', { value: 'tpl:' + t.id, text: 'Template: ' + t.name }));
        });
      });
    }

    savePlanBtn.addEventListener('click', function () {
      if (!state.ctx || state.busy) return;
      state.busy = true;
      setStatus('Saving plan…');
      savePlanVersion(state.ctx.publicationId, state.ctx.sectionId, filter.issueId, arrangementPayload())
        .then(function (res) {
          setStatus('Saved as v' + res.version + ' (' + res.date + '). Nothing was created' +
            (res.pruned ? '; ' + res.pruned + ' old version(s) removed.' : '.'), 'ok');
          return refreshLoadList();
        })
        .catch(function (e) { setStatus('Could not save the plan: ' + e.message, 'error'); })
        .then(function () { state.busy = false; refresh(); });
    });

    saveTplBtn.addEventListener('click', function () {
      if (!state.ctx || state.busy) return;
      var name = window.prompt('Name this arrangement so it can be reused on other issues:', '');
      if (!name) return;
      state.busy = true;
      setStatus('Saving template…');
      saveIssueTemplate(state.ctx.publicationId, state.ctx.sectionId, name, arrangementPayload())
        .then(function () {
          setStatus('Saved as template "' + name + '".', 'ok');
          return refreshLoadList();
        })
        .catch(function (e) { setStatus('Could not save the template: ' + e.message, 'error'); })
        .then(function () { state.busy = false; refresh(); });
    });

    loadSelect.addEventListener('change', function () {
      var v = loadSelect.value;
      if (!v) return;
      loadSelect.value = '';

      function apply(arrangement, byOrder, label) {
        if (arrangement.pageCount && arrangement.pageCount > grid.slots.length) {
          pageCount.value = String(arrangement.pageCount);
          state.pageCountTouched = true;
          buildSlots(1, arrangement.pageCount);
          if (state.model) overlayExisting(state.model);
        }
        if (arrangement.layoutPattern) patternInput.value = arrangement.layoutPattern;
        var res = applyArrangement(arrangement, { byOrder: byOrder });
        refresh();
        setStatus(res.skipped.length
          ? 'Loaded ' + label + ' — ' + res.applied + ' placed, ' + res.skipped.length +
            ' skipped (already in the issue, or no room): ' + res.skipped.join(', ')
          : 'Loaded ' + label + ' — ' + res.applied + ' placed. Nothing created yet.',
          res.skipped.length ? 'error' : 'ok');
      }

      var isPlan = v.indexOf('plan:') === 0;
      var id = v.replace(/^(plan|tpl):/, '');
      var meta = isPlan ? (state.versions || []).filter(function (x) { return x.id === id; })[0] : null;

      state.busy = true;
      setStatus(isPlan ? 'Loading plan…' : 'Loading template…');
      loadJsonObject(id).then(function (cfg) {
        // A plan belongs to this issue, so restore it at the page numbers it was
        // saved at. An issue template is an ordered sequence with no issue of its
        // own, so lay it out from the first free page instead.
        apply(cfg, !isPlan, isPlan
          ? ('plan ' + (meta && !meta.legacy ? 'v' + meta.version : '(before versioning)') +
             (meta && meta.date ? ' from ' + meta.date : ''))
          : 'the template');
      }).catch(function (e) {
        setStatus('Could not load: ' + e.message, 'error');
      }).then(function () { state.busy = false; refresh(); });
    });

    // ── load ──
    buildSlots(1, Number(pageCount.value) || 16);
    refresh();

    loadContextNames(filter).then(function (ctx) {
      state.ctx = ctx;
      // Section now comes from each template's own category; ctx.section is only
      // the fallback for templates that have none.
      ctxLine.textContent = ctx.publication + ' · ' + ctx.issue + ' · ' + ctx.pubChannel +
        ' · category from template, else ' + (ctx.section || '—');
      return loadTemplates(ctx.publicationId);
    }).then(function (templates) {
      state.templates = templates;
      state.blank = guessBlankTemplate(templates, settings.blankTemplateHint);
      renderTemplates();
      refresh();
      var multiPage = templates.filter(function (t) { return t.pageCount > 1; })
        .map(function (t) { return t.id; });
      return Promise.all([
        loadThumbUrls(templates.map(function (t) { return t.id; })),
        multiPage.length ? loadPageThumbUrls(multiPage) : null,
      ]);
    }).then(function () {
      renderTemplates();
      refresh();
      // Offer saved arrangements only once templates are known, so loading one
      // has something to resolve template names against.
      return refreshLoadList();
    }).then(function () {
      var vs = state.versions || [];
      if (vs.length) {
        setStatus(vs.length + ' saved plan version(s) for this issue — latest ' +
          (vs[0].legacy ? '(before versioning)' : 'v' + vs[0].version) +
          (vs[0].date ? ' from ' + vs[0].date : '') +
          (vs[0].savedBy ? ' by ' + vs[0].savedBy : '') + '. Pick one under Load to restore it.');
      }
    }).catch(function (e) {
      ctxLine.textContent = 'failed';
      setStatus(e.message, 'error');
    });

    loadIssueModel(filter.issueId, filter.editionId).then(function (model) {
      state.model = model;
      // Seed the page count from the issue's own expectation, unless the user
      // has already typed something.
      if (model.expectedPages && !state.pageCountTouched) {
        pageCount.value = String(model.expectedPages);
        buildSlots(1, model.expectedPages);
      }
      var locked = overlayExisting(model);
      if (locked) setStatus(locked + ' layout(s) already in this issue are locked.');
      refresh();
    }).catch(function (e) {
      setStatus('Could not read the issue\'s pages: ' + e.message, 'error');
    });

    // ── create ──
    createBtn.addEventListener('click', function () {
      if (state.busy || !state.ctx) return;
      var slots = plannedSlots(state.blank);
      if (!slots.length) return;

      var named = nameSlots(slots, patternInput.value || settings.layoutPattern, state.ctx);
      state.busy = true;
      createBtn.disabled = true;
      setStatus('Creating ' + named.length + ' layout(s)…');

      createLayouts(named, state.ctx).then(function (created) {
        // CreateLayouts returns Pages: null, so the response cannot confirm the
        // page plan landed — re-read the issue and check what actually appeared.
        setStatus('Created ' + created.length + ' layout(s). Verifying pages…');
        return loadIssueModel(filter.issueId, filter.editionId).then(function (model) {
          state.model = model;
          var wanted = {};
          named.forEach(function (s) { for (var p = s.page; p <= s.pageEnd; p++) wanted[p] = true; });
          var landed = 0, missing = [];
          Object.keys(wanted).forEach(function (p) {
            if (model.occupied[p]) landed++; else missing.push(p);
          });
          rebuild();
          if (missing.length) {
            setStatus('Created ' + created.length + ', but ' + missing.length +
              ' planned page(s) are not showing yet: ' + missing.join(', ') +
              '. Refresh Publication Overview in a moment.', 'error');
          } else {
            setStatus('Done — ' + created.length + ' layout(s), ' + landed + ' pages, all in place.', 'ok');
            notify('Issue Creator: ' + created.length + ' layout(s) created.', 'default');
          }
        });
      }).catch(function (e) {
        setStatus('Create failed: ' + e.message, 'error');
      }).then(function () {
        state.busy = false;
        refresh();
      });
    });

    settings.layoutPattern = patternInput.value;
    patternInput.addEventListener('change', function () {
      settings.layoutPattern = patternInput.value;
      saveSettings(settings);
    });
  }
