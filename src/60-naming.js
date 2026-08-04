  // ─── Naming patterns ───────────────────────────────────────────────────────
  // Ported unchanged from the Electron PoC, where it was exercised across
  // several real issue builds. Tokens: {issue} {brand} {template} {page}
  // {pageend} {pagerange}; page tokens take :0N zero-padding.

  function applyPattern(pattern, ctx) {
    function pad(n, w) { return String(n).padStart(Number(w), '0'); }
    function range(w) {
      return ctx.pageEnd > ctx.page ? pad(ctx.page, w) + '-' + pad(ctx.pageEnd, w) : pad(ctx.page, w);
    }
    return String(pattern)
      .replace(/\{pagerange:0(\d)\}/g, function (_, w) { return range(w); })
      .replace(/\{pagerange\}/g, function () { return range(1); })
      .replace(/\{pageend:0(\d)\}/g, function (_, w) { return pad(ctx.pageEnd, w); })
      .replace(/\{pageend\}/g, String(ctx.pageEnd))
      .replace(/\{page:0(\d)\}/g, function (_, w) { return pad(ctx.page, w); })
      .replace(/\{page\}/g, String(ctx.page))
      .replace(/\{issue\}/g, ctx.issue || '')
      .replace(/\{brand\}/g, ctx.brand || '')
      .replace(/\{template\}/g, ctx.template || '');
  }

  // Fill in slot.name for a set of slots about to be created.
  function nameSlots(slots, pattern, ctx) {
    return slots.map(function (slot) {
      var end = slot.pageEnd || slot.page;
      return Object.assign({}, slot, {
        pageEnd: end,
        name: applyPattern(pattern, {
          page: slot.page,
          pageEnd: end,
          issue: ctx.issue,
          brand: ctx.publication,
          template: slot.templateName,
        }),
      });
    });
  }
