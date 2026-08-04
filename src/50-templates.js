  // ─── Layout templates ──────────────────────────────────────────────────────

  // A template's page count comes from its PageRange metadata: "002-005" is a
  // 4-page template, so assigning it to a slot spans four consecutive pages.
  function parseRange(s) {
    var m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(String(s || '').trim());
    if (!m) return null;
    var a = Number(m[1]);
    var b = m[2] ? Number(m[2]) : a;
    return { start: a, end: Math.max(a, b) };
  }

  function templatePageCount(pageRange) {
    var r = parseRange(pageRange);
    return r ? (r.end - r.start + 1) : 1;
  }

  function loadTemplates(publicationId) {
    return callServer('QueryObjects', {
      Params: [
        { __classname__: 'QueryParam', Property: 'Type', Operation: '=', Value: 'LayoutTemplate' },
        { __classname__: 'QueryParam', Property: 'PublicationId', Operation: '=', Value: String(publicationId) },
      ],
      FirstEntry: 1,
      MaxEntries: 200,
      Hierarchical: false,
      Order: [],
      MinimalProps: ['ID', 'Name', 'Category', 'PageRange', 'Modified'],
      RequestProps: null,
      Areas: ['Workflow'],
      GetHidden: false,
    }).then(function (r) {
      var cols = (r.Columns || []).map(function (c) { return c.Name; });
      return (r.Rows || []).map(function (row) {
        var o = {};
        for (var i = 0; i < cols.length; i++) o[cols[i]] = row[i];
        return {
          id: String(o.ID),
          name: o.Name,
          category: o.Category,
          pageRange: o.PageRange,
          pageCount: templatePageCount(o.PageRange),
          modified: o.Modified,
        };
      });
    });
  }

  // Whichever template looks like the brand's blank page, for filling empty slots.
  function guessBlankTemplate(templates, hint) {
    var needle = String(hint || 'blank').toLowerCase();
    for (var i = 0; i < templates.length; i++) {
      if (String(templates[i].name).toLowerCase().indexOf(needle) !== -1) return templates[i];
    }
    return null;
  }
