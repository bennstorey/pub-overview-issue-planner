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
      grid.slots.push({
        page: firstPage + i, templateId: null, templateName: null,
        span: 1, covered: false, include: true,
      });
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
      templateCategory: template.category || '', span: span, covered: false,
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

  // The slots a create run should act on: assigned, not covered, not existing,
  // and not deselected. Empty slots are included only when a blank template is
  // configured — and only if they are selected.
  //
  // `section` is the template's own category — a layout made from the News
  // template belongs in News, regardless of what the page grid is filtered to.
  // Left empty when the template has none, and the caller falls back.
  function plannedSlots(blankTemplate) {
    var out = [];
    for (var i = 0; i < grid.slots.length; i++) {
      var s = grid.slots[i];
      if (s.covered || s.existing) continue;
      if (s.include === false) continue;
      if (s.templateId) {
        out.push({
          page: s.page, pageEnd: s.page + (s.span || 1) - 1,
          templateId: s.templateId, templateName: s.templateName,
          section: s.templateCategory || '',
        });
      } else if (blankTemplate) {
        out.push({
          page: s.page, pageEnd: s.page + (blankTemplate.pageCount || 1) - 1,
          templateId: blankTemplate.id, templateName: blankTemplate.name,
          section: blankTemplate.category || '',
        });
      }
    }
    return out;
  }

  // ── Selecting which pages to create ───────────────────────────────────────
  // A slot is included unless explicitly turned off, so the default stays
  // "create everything planned" and partial runs are a deliberate act.

  function setIncluded(i, on) {
    var o = ownerIndex(i);
    grid.slots[o].include = !!on;
  }

  function setAllIncluded(on) {
    for (var i = 0; i < grid.slots.length; i++) {
      if (!grid.slots[i].covered && !grid.slots[i].existing) grid.slots[i].include = !!on;
    }
  }

  // ── Reordering ────────────────────────────────────────────────────────────
  // Moves an assignment from one page to another, so a plan can be rearranged
  // without re-picking templates. Only unrealised slots move: pages that exist
  // in the issue are anchored to their real page numbers, and changing those
  // means repaging live production content, not editing a plan.

  function moveAssignment(fromIndex, toIndex) {
    var from = ownerIndex(fromIndex);
    var to = ownerIndex(toIndex);
    if (from === to) return null;

    var src = grid.slots[from];
    if (src.existing) return 'Pages already in the issue cannot be moved from here.';
    if (!src.templateId) return 'That page has nothing on it to move.';

    var span = src.span || 1;
    var dest = grid.slots[to];
    if (dest.existing) return 'p' + pad3(dest.page) + ' is already in the issue.';
    if (to + span > grid.slots.length) {
      return 'A ' + span + '-page item does not fit at p' + pad3(dest.page) + '.';
    }
    // The destination must be clear of locked pages across the whole span —
    // ignoring the source itself, which is about to be vacated.
    for (var j = to; j < to + span; j++) {
      if (j >= from && j < from + span) continue;
      var owner = grid.slots[j].covered ? grid.slots[ownerIndex(j)] : grid.slots[j];
      if (owner.existing) {
        return 'Moving there would overlap p' + pad3(grid.slots[j].page) +
          ', already in this issue ("' + owner.existing.name + '").';
      }
    }

    var payload = {
      templateId: src.templateId, templateName: src.templateName,
      templateCategory: src.templateCategory || '', span: span,
      include: src.include !== false,
    };

    clearSlotSpan(from);
    // Clear whatever is at the destination, then write the moved item in.
    for (var k = to; k < to + span; k++) {
      if (grid.slots[k].templateId || grid.slots[k].covered) clearSlotSpan(k);
    }
    grid.slots[to] = {
      page: grid.slots[to].page, templateId: payload.templateId, templateName: payload.templateName,
      templateCategory: payload.templateCategory, span: payload.span, covered: false,
      include: payload.include,
    };
    for (var m = to + 1; m < to + span; m++) {
      grid.slots[m] = { page: grid.slots[m].page, templateId: null, templateName: null, span: 1, covered: true };
    }
    grid.selected = to;
    return null;
  }

  // ── Serialising an arrangement ────────────────────────────────────────────
  // Only the assignments; existing pages are never stored, since they belong to
  // the issue rather than to the plan and are re-read fresh every time.

  function serializeArrangement() {
    var items = [];
    for (var i = 0; i < grid.slots.length; i++) {
      var s = grid.slots[i];
      if (s.covered || s.existing || !s.templateId) continue;
      items.push({
        page: s.page, span: s.span || 1,
        templateId: s.templateId, templateName: s.templateName,
        templateCategory: s.templateCategory || '',
        include: s.include !== false,
      });
    }
    return { pageCount: grid.slots.length, items: items };
  }

  // Applies a saved arrangement over the current grid. Existing pages always
  // win: an entry whose pages have been created since the save is skipped and
  // reported, rather than silently dropped or overwriting live content.
  function applyArrangement(arrangement, options) {
    options = options || {};
    var items = (arrangement && arrangement.items) || [];
    var offset = options.byOrder ? null : 0; // byOrder ignores stored page numbers
    var skipped = [];
    var applied = 0;

    if (options.byOrder) {
      // Issue templates are an ordered sequence, so lay them from the first
      // free page rather than at whatever page numbers they were saved at.
      var cursor = 0;
      for (var n = 0; n < items.length; n++) {
        var it = items[n];
        while (cursor < grid.slots.length &&
               (grid.slots[cursor].covered || grid.slots[cursor].existing)) cursor++;
        if (cursor >= grid.slots.length) { skipped.push(it.templateName); continue; }
        grid.selected = cursor;
        var err = assignTemplate({
          id: it.templateId, name: it.templateName,
          pageCount: it.span, category: it.templateCategory,
        });
        if (err) skipped.push(it.templateName);
        else { grid.slots[cursor].include = it.include !== false; applied++; }
        cursor += it.span;
      }
    } else {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var idx = slotAt(item.page + offset);
        if (idx < 0) { skipped.push('p' + pad3(item.page)); continue; }
        grid.selected = idx;
        var e = assignTemplate({
          id: item.templateId, name: item.templateName,
          pageCount: item.span, category: item.templateCategory,
        });
        if (e) skipped.push('p' + pad3(item.page));
        else { grid.slots[idx].include = item.include !== false; applied++; }
      }
    }
    grid.selected = null;
    return { applied: applied, skipped: skipped };
  }

  function gridCounts() {
    var assigned = 0, empty = 0, existing = 0, excluded = 0;
    for (var i = 0; i < grid.slots.length; i++) {
      var s = grid.slots[i];
      if (s.covered) continue;
      if (s.existing) { existing++; continue; }
      if (s.include === false) excluded++;
      if (s.templateId) assigned++; else empty++;
    }
    return { assigned: assigned, empty: empty, existing: existing, excluded: excluded };
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  function renderGrid(container) {
    container.textContent = '';
    var pending = [];       // objects still missing a single thumb
    var pendingPages = [];  // spreads still missing their per-page thumbs

    grid.slots.forEach(function (slot, i) {
      if (slot.covered) return; // drawn as part of the owning spread
      var span = slot.span || 1;

      var classes = 'ic-slot';
      if (grid.selected === i) classes += ' ic-selected';
      if (slot.templateId) classes += ' ic-filled';
      if (slot.existing) classes += ' ic-existing';
      if (!slot.existing && slot.include === false) classes += ' ic-excluded';

      var node = el('div', { class: classes });
      if (span > 1) node.style.gridColumn = 'span ' + span;

      // Drag to rearrange the plan. Only assigned, unrealised slots move.
      if (slot.templateId && !slot.existing) {
        node.setAttribute('draggable', 'true');
        node.addEventListener('dragstart', function (ev) {
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('text/plain', String(i));
        });
      }
      if (!slot.existing) {
        node.addEventListener('dragover', function (ev) {
          ev.preventDefault();
          ev.dataTransfer.dropEffect = 'move';
          node.classList.add('ic-drop');
        });
        node.addEventListener('dragleave', function () { node.classList.remove('ic-drop'); });
        node.addEventListener('drop', function (ev) {
          ev.preventDefault();
          node.classList.remove('ic-drop');
          var from = Number(ev.dataTransfer.getData('text/plain'));
          if (isNaN(from)) return;
          var err = moveAssignment(from, i);
          if (err && grid.onError) grid.onError(err);
          if (grid.onChange) grid.onChange();
        });
      }

      var thumbId = slot.existing ? slot.existing.id : slot.templateId;
      var thumbBox = el('div', { class: 'ic-slot-thumb' });
      // A multi-page object's own thumb is only its first spread, so show one
      // preview per page whenever we have them.
      var perPage = thumbId && span > 1 ? pageThumbUrls(thumbId) : null;
      var url = thumbId ? thumbUrl(thumbId) : null;
      if (perPage && perPage.length) {
        var strip = el('div', { class: 'ic-page-strip' });
        perPage.forEach(function (u) { strip.appendChild(el('img', { src: u, alt: '' })); });
        thumbBox.appendChild(strip);
      } else if (url) {
        thumbBox.appendChild(el('img', { src: url, alt: '' }));
      } else {
        thumbBox.appendChild(el('span', { class: 'ic-slot-empty', text: thumbId ? '…' : 'blank' }));
      }
      if (thumbId) {
        if (!url) pending.push(String(thumbId));
        if (span > 1 && !perPage) pendingPages.push(String(thumbId));
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
      var subTitle = slot.existing ? sub
        : (slot.templateName
            ? slot.templateName + (slot.templateCategory ? '\ncategory: ' + slot.templateCategory : '\nno category on this template')
            : 'empty');

      node.appendChild(thumbBox);
      node.appendChild(pageLine);
      node.appendChild(el('div', { class: 'ic-slot-tpl', title: subTitle, text: sub }));

      if (slot.templateId && !slot.existing) {
        var clear = el('button', { class: 'ic-slot-clear', title: 'Clear', text: '×' });
        clear.addEventListener('click', function (ev) {
          ev.stopPropagation();
          clearSlotSpan(i);
          if (grid.onChange) grid.onChange();
        });
        node.appendChild(clear);
      }

      // Include/exclude this page from the next create run.
      if (!slot.existing) {
        var box = el('input', { type: 'checkbox', class: 'ic-slot-include', title: 'Include in the next create run' });
        box.checked = slot.include !== false;
        box.addEventListener('click', function (ev) { ev.stopPropagation(); });
        box.addEventListener('change', function () {
          setIncluded(i, box.checked);
          if (grid.onChange) grid.onChange();
        });
        node.appendChild(box);
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

    // Thumbnails we did not have yet: fetch, then redraw once. Both requests go
    // together so a spread does not trigger two separate redraws.
    if (pending.length || pendingPages.length) {
      Promise.all([
        pending.length ? loadThumbUrls(pending) : Promise.resolve(),
        pendingPages.length ? loadPageThumbUrls(pendingPages) : Promise.resolve(),
      ]).then(function () {
        if (grid.onChange) grid.onChange();
      });
    }
  }
