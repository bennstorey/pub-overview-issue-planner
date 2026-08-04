  // ─── Slot grid ─────────────────────────────────────────────────────────────
  // Ported from the Electron PoC, where the span/covered-slot model was proven
  // across several real issue builds.
  //
  // A slot is one page. A multi-page template assigned to a slot gives it a
  // span, and the pages it covers become `covered` slots — they still exist so
  // page numbering stays honest, but they are not rendered and cannot be
  // assigned to. `existing` marks a page already in the issue: locked, never
  // touched by a create run.

  var grid = {
    slots: [],        // [{ page, templateId, templateName, span, covered, existing }]
    selected: null,   // index of the selected slot
    onChange: null,   // called after any mutation so the dialog can re-render
  };

  function pad3(n) { return String(n).padStart(3, '0'); }

  function buildSlots(firstPage, count) {
    grid.slots = [];
    for (var i = 0; i < count; i++) {
      grid.slots.push({ page: firstPage + i, templateId: null, templateName: null, span: 1, covered: false });
    }
    grid.selected = null;
  }

  // A covered slot belongs to the spanned slot that starts before it.
  function ownerIndex(i) {
    var k = i;
    while (k > 0 && grid.slots[k].covered) k--;
    return k;
  }

  function slotAt(page) {
    for (var i = 0; i < grid.slots.length; i++) if (grid.slots[i].page === page) return i;
    return -1;
  }

  function clearSlotSpan(i) {
    var o = ownerIndex(i);
    var span = grid.slots[o].span || 1;
    for (var j = o; j < o + span && j < grid.slots.length; j++) {
      grid.slots[j] = { page: grid.slots[j].page, templateId: null, templateName: null, span: 1, covered: false };
    }
  }

  // GetPagesInfo returns one PageObject per page per edition, so the same page
  // can appear more than once; collapse to one span per layout.
  function existingSpans(model) {
    var byLayout = {};
    var pages = model.pages || [];
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      if (!p.layoutId || !p.pageOrder) continue;
      var e = byLayout[p.layoutId];
      if (!e) byLayout[p.layoutId] = { layoutId: p.layoutId, start: p.pageOrder, end: p.pageOrder };
      else {
        if (p.pageOrder < e.start) e.start = p.pageOrder;
        if (p.pageOrder > e.end) e.end = p.pageOrder;
      }
    }
    return Object.keys(byLayout).map(function (id) {
      var span = byLayout[id];
      var meta = (model.layouts || {})[id] || {};
      span.name = meta.name || ('layout ' + id);
      span.stateName = meta.stateName || '';
      span.lockedBy = meta.lockedBy || '';
      return span;
    }).sort(function (a, b) { return a.start - b.start; });
  }

  // Lock the pages already in the issue, extending the grid if they run past
  // the requested page count.
  function overlayExisting(model) {
    var spans = existingSpans(model);
    if (!spans.length) return 0;

    var first = grid.slots.length ? grid.slots[0].page : 1;
    var last = grid.slots.length ? grid.slots[grid.slots.length - 1].page : 0;
    var maxPage = spans[spans.length - 1].end;
    for (var pg = last + 1; pg <= maxPage; pg++) {
      grid.slots.push({ page: pg, templateId: null, templateName: null, span: 1, covered: false });
    }

    var placed = 0;
    for (var s = 0; s < spans.length; s++) {
      var sp = spans[s];
      if (sp.end < first) continue;
      var i = slotAt(Math.max(sp.start, first));
      if (i < 0) continue;
      var span = sp.end - grid.slots[i].page + 1;
      if (span < 1) continue;

      for (var j = i; j < i + span && j < grid.slots.length; j++) {
        if (grid.slots[j].templateId || grid.slots[j].covered) clearSlotSpan(j);
      }
      grid.slots[i] = {
        page: grid.slots[i].page, templateId: null, templateName: null,
        span: span, covered: false,
        existing: { id: sp.layoutId, name: sp.name, stateName: sp.stateName, lockedBy: sp.lockedBy },
      };
      for (var k = i + 1; k < i + span && k < grid.slots.length; k++) {
        grid.slots[k] = { page: grid.slots[k].page, templateId: null, templateName: null, span: 1, covered: true };
      }
      placed++;
    }
    return placed;
  }

  // Returns an error string, or null on success.
  function assignTemplate(template) {
    if (grid.selected === null) return 'Select a page first.';
    var i = grid.selected;
    var span = template.pageCount || 1;

    if (i + span > grid.slots.length) {
      return '"' + template.name + '" is ' + span + ' pages but only ' +
        (grid.slots.length - i) + ' remain from p' + pad3(grid.slots[i].page) + '.';
    }
    // Never write over a page that already exists in the issue.
    for (var j = i; j < i + span; j++) {
      var owner = grid.slots[j].covered ? grid.slots[ownerIndex(j)] : grid.slots[j];
      if (owner.existing) {
        return '"' + template.name + '" would overlap p' + pad3(grid.slots[j].page) +
          ', already in this issue ("' + owner.existing.name + '").';
      }
    }
    // Clear anything the new span overlaps, including spreads starting earlier.
    for (var c = i; c < i + span; c++) {
      if (grid.slots[c].templateId || grid.slots[c].covered) clearSlotSpan(c);
    }

    grid.slots[i] = {
      page: grid.slots[i].page, templateId: template.id, templateName: template.name,
      span: span, covered: false,
    };
    for (var k = i + 1; k < i + span; k++) {
      grid.slots[k] = { page: grid.slots[k].page, templateId: null, templateName: null, span: 1, covered: true };
    }

    // Auto-advance past the spread to the next assignable slot.
    var next = i + span;
    while (next < grid.slots.length && (grid.slots[next].covered || grid.slots[next].existing)) next++;
    grid.selected = next < grid.slots.length ? next : null;
    return null;
  }

  // The slots a create run should act on: assigned, not covered, not existing.
  // Empty slots are included only when a blank template is configured.
  function plannedSlots(blankTemplate) {
    var out = [];
    for (var i = 0; i < grid.slots.length; i++) {
      var s = grid.slots[i];
      if (s.covered || s.existing) continue;
      if (s.templateId) {
        out.push({
          page: s.page, pageEnd: s.page + (s.span || 1) - 1,
          templateId: s.templateId, templateName: s.templateName,
        });
      } else if (blankTemplate) {
        out.push({
          page: s.page, pageEnd: s.page + (blankTemplate.pageCount || 1) - 1,
          templateId: blankTemplate.id, templateName: blankTemplate.name,
        });
      }
    }
    return out;
  }

  function gridCounts() {
    var assigned = 0, empty = 0, existing = 0;
    for (var i = 0; i < grid.slots.length; i++) {
      var s = grid.slots[i];
      if (s.covered) continue;
      if (s.existing) existing++;
      else if (s.templateId) assigned++;
      else empty++;
    }
    return { assigned: assigned, empty: empty, existing: existing };
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  function renderGrid(container) {
    container.textContent = '';
    var pending = [];

    grid.slots.forEach(function (slot, i) {
      if (slot.covered) return; // drawn as part of the owning spread
      var span = slot.span || 1;

      var classes = 'ic-slot';
      if (grid.selected === i) classes += ' ic-selected';
      if (slot.templateId) classes += ' ic-filled';
      if (slot.existing) classes += ' ic-existing';

      var node = el('div', { class: classes });
      if (span > 1) node.style.gridColumn = 'span ' + span;

      var thumbId = slot.existing ? slot.existing.id : slot.templateId;
      var thumbBox = el('div', { class: 'ic-slot-thumb' });
      var url = thumbId ? thumbUrl(thumbId) : null;
      if (url) {
        thumbBox.appendChild(el('img', { src: url, alt: '' }));
      } else {
        thumbBox.appendChild(el('span', { class: 'ic-slot-empty', text: thumbId ? '…' : 'blank' }));
        if (thumbId) pending.push(String(thumbId));
      }

      var label = span > 1
        ? 'p' + pad3(slot.page) + '–p' + pad3(slot.page + span - 1)
        : 'p' + pad3(slot.page);
      var pageLine = el('div', { class: 'ic-slot-page' }, [el('span', { text: label })]);
      if (span > 1) pageLine.appendChild(el('span', { class: 'ic-badge', text: span + '-page' }));
      if (slot.existing) pageLine.appendChild(el('span', { class: 'ic-badge ic-badge-existing', text: 'in issue' }));

      var sub = slot.existing
        ? slot.existing.name + (slot.existing.stateName ? ' · ' + slot.existing.stateName : '')
        : (slot.templateName || '—');

      node.appendChild(thumbBox);
      node.appendChild(pageLine);
      node.appendChild(el('div', { class: 'ic-slot-tpl', title: sub, text: sub }));

      if (slot.templateId && !slot.existing) {
        var clear = el('button', { class: 'ic-slot-clear', title: 'Clear', text: '×' });
        clear.addEventListener('click', function (ev) {
          ev.stopPropagation();
          clearSlotSpan(i);
          if (grid.onChange) grid.onChange();
        });
        node.appendChild(clear);
      }

      if (!slot.existing) {
        node.addEventListener('click', function () {
          grid.selected = (grid.selected === i) ? null : i;
          if (grid.onChange) grid.onChange();
        });
      } else {
        node.title = slot.existing.lockedBy
          ? 'Locked — in use by ' + slot.existing.lockedBy
          : 'Already in this issue';
      }

      container.appendChild(node);
    });

    // Thumbnails we did not have yet: fetch, then redraw once.
    if (pending.length) {
      loadThumbUrls(pending).then(function () {
        if (grid.onChange) grid.onChange();
      });
    }
  }
