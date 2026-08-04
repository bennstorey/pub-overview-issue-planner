  // ─── Planner dialog ────────────────────────────────────────────────────────
  // SCAFFOLD: this proves the whole plumbing end to end — context resolution,
  // planning-endpoint access, template listing, occupied-page detection — and
  // hosts the protocol confirmation. The slot grid and template gallery from the
  // Electron PoC land here next.

  var DIALOG_CSS = [
    '.ic-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center}',
    '.ic-dialog{background:#fff;color:#222;border-radius:6px;min-width:560px;max-width:80vw;max-height:80vh;',
    '  display:flex;flex-direction:column;font:13px/1.5 system-ui,sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.35)}',
    '.ic-dialog h2{margin:0;padding:14px 18px;border-bottom:1px solid #e3e3e3;font-size:15px;font-weight:600}',
    '.ic-body{padding:14px 18px;overflow:auto}',
    '.ic-body dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0 0 12px}',
    '.ic-body dt{color:#666}',
    '.ic-body dd{margin:0}',
    '.ic-list{max-height:180px;overflow:auto;border:1px solid #e3e3e3;border-radius:4px;padding:6px 10px;margin:0 0 12px}',
    '.ic-list div{padding:2px 0}',
    '.ic-muted{color:#777}',
    '.ic-ok{color:#137333}',
    '.ic-bad{color:#c5221f}',
    '.ic-actions{padding:12px 18px;border-top:1px solid #e3e3e3;display:flex;justify-content:flex-end;gap:8px}',
    '.ic-actions button{padding:6px 14px;border-radius:4px;border:1px solid #bbb;background:#f6f6f6;cursor:pointer}',
    '.ic-actions button.ic-primary{background:#1a73e8;border-color:#1a73e8;color:#fff}',
  ].join('\n');

  function injectCss() {
    if (document.getElementById('ic-styles')) return;
    var style = document.createElement('style');
    style.id = 'ic-styles';
    style.textContent = DIALOG_CSS;
    document.head.appendChild(style);
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

  function openPlannerDialog() {
    injectCss();
    var filter = currentFilter();
    if (!filter.issueId) {
      notify('Open an issue in Publication Overview first.', 'error');
      return;
    }

    var ctxList = el('dl');
    var accessLine = el('div', { class: 'ic-muted', text: 'Checking planning access…' });
    var freeLine = el('div', { class: 'ic-muted', text: '' });
    var templateList = el('div', { class: 'ic-list', text: 'Loading templates…' });

    var closeBtn = el('button', { text: 'Close' });
    var confirmBtn = el('button', { class: 'ic-primary', text: 'Confirm protocol' });
    confirmBtn.disabled = true;

    var dialog = el('div', { class: 'ic-dialog' }, [
      el('h2', { text: 'Issue Creator — scaffold v' + VERSION }),
      el('div', { class: 'ic-body' }, [ctxList, accessLine, freeLine, templateList]),
      el('div', { class: 'ic-actions' }, [closeBtn, confirmBtn]),
    ]);
    var overlay = el('div', { class: 'ic-overlay' }, [dialog]);
    document.body.appendChild(overlay);

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });

    function row(term, value) {
      ctxList.appendChild(el('dt', { text: term }));
      ctxList.appendChild(el('dd', { text: value }));
    }

    var state = { ctx: null, templates: [], model: null };

    checkPlanningAccess().then(function (ok) {
      accessLine.className = ok ? 'ic-ok' : 'ic-bad';
      accessLine.textContent = ok
        ? 'Planning endpoint reachable on this session.'
        : 'Planning endpoint rejected this session — this account may lack planning rights.';
      confirmBtn.disabled = !ok;
    });

    // The filter's key names are undocumented and not all are what the notes
    // suggest — log the raw object so a wrong assumption is visible, not silent.
    console.info(TAG + ' currentFilterSetting():', filter);

    loadContextNames(filter).then(function (ctx) {
      state.ctx = ctx;
      row('Brand', ctx.publication + ' (' + ctx.publicationId + ')');
      row('Issue', ctx.issue + ' (' + ctx.issueId + ')');
      row('Channel', ctx.pubChannel + ' (' + ctx.pubChannelId + ')');
      row('Section', ctx.section
        ? ctx.section + (ctx.sectionDefaulted ? ' — defaulted, no category selected' : '')
        : '— none available');
      return loadTemplates(ctx.publicationId);
    }).then(function (templates) {
      state.templates = templates;
      templateList.textContent = '';
      if (!templates.length) {
        templateList.appendChild(el('div', { class: 'ic-muted', text: 'No layout templates in this brand.' }));
        return;
      }
      templates.forEach(function (t) {
        templateList.appendChild(el('div', {
          text: t.name + '  —  ' + t.pageCount + 'pp' + (t.pageRange ? ' (' + t.pageRange + ')' : ''),
        }));
      });
      var blank = guessBlankTemplate(templates, loadSettings().blankTemplateHint);
      if (blank) templateList.appendChild(el('div', { class: 'ic-muted', text: 'Blank-page template: ' + blank.name }));
    }).catch(function (e) {
      templateList.textContent = 'Failed: ' + e.message;
      templateList.className = 'ic-list ic-bad';
    });

    loadIssueModel(filter.issueId, filter.editionId).then(function (model) {
      state.model = model;
      var taken = Object.keys(model.occupied).map(Number).sort(function (a, b) { return a - b; });
      freeLine.textContent = model.expectedPages
        ? model.expectedPages + ' pages expected, ' + taken.length + ' already occupied' +
          (taken.length ? ' (' + taken.join(', ') + ')' : '')
        : taken.length + ' pages already occupied';
    }).catch(function (e) {
      freeLine.className = 'ic-bad';
      freeLine.textContent = 'Could not read issue pages: ' + e.message;
    });

    // Step 2 of the build plan: pin down the __classname__ strategy by creating
    // one throwaway layout on the first free page, through the real client.
    confirmBtn.addEventListener('click', function () {
      if (!state.ctx) { notify('Still resolving the brand and issue — try again in a moment.', 'error'); return; }
      if (!state.templates.length) {
        notify('No layout templates in ' + state.ctx.publication + ', so there is nothing to create from.', 'error');
        return;
      }
      var template = state.templates[0];
      var page = 1;
      while (state.model && state.model.occupied[page]) page++;
      var slot = {
        page: page,
        pageEnd: page + template.pageCount - 1,
        templateId: template.id,
        templateName: template.name,
        name: 'PROTOCOL-CHECK-' + new Date().toISOString().slice(0, 10),
      };
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Creating…';
      confirmProtocol(slot, state.ctx).then(function (res) {
        notify('Protocol confirmed: "' + res.strategy + '" — layout ' + res.layout.Id + ' created on page ' + page + '. Delete it when done.', 'default');
        confirmBtn.textContent = 'Confirmed: ' + res.strategy;
      }).catch(function (e) {
        notify('Protocol check failed: ' + e.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm protocol';
      });
    });
  }
