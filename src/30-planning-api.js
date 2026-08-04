  // ─── Planning API (editorialplan.php) ─────────────────────────────────────
  // CreateLayouts instantiates layouts from their templates with the page plan
  // already applied — Page.PageOrder is the real page number. This replaces the
  // old PoC pipeline entirely (download native -> upload to transfer server ->
  // CreateObjects -> relate -> target -> renumber via local InDesign).
  //
  // Studio's JSON-RPC is strongly typed: nested objects need a __classname__ or
  // the deserializer drops every field and reports them as unspecified. The
  // planning interface's exact type names are not in the SDK docs, so the
  // strategy is configurable and confirmProtocol() below pins it down.

  var CLASSNAME_STRATEGIES = {
    // Matches the workflow interface convention (bare entity names).
    bare: { fromTemplate: 'LayoutFromTemplate', layout: 'Layout', page: 'Page' },
    // Matches the Pln prefix seen on PlnCreateLayoutsResponse.
    pln: { fromTemplate: 'PlnLayoutFromTemplate', layout: 'PlnLayout', page: 'PlnPage' },
    // No markers at all — known to fail, kept so confirmProtocol can prove it.
    none: { fromTemplate: null, layout: null, page: null },
  };

  var strategy = 'bare';

  function cls(name) { return name ? { __classname__: name } : {}; }

  // slot: { page, pageEnd, templateId, templateName, name }
  // ctx:  { publication, issue, pubChannel, section }
  function buildLayoutFromTemplate(slot, ctx) {
    var s = CLASSNAME_STRATEGIES[strategy];
    var end = slot.pageEnd || slot.page;
    var pages = [];
    for (var p = slot.page, seq = 1; p <= end; p++, seq++) {
      pages.push(Object.assign(cls(s.page), { PageOrder: p, PageSequence: seq }));
    }
    return Object.assign(cls(s.fromTemplate), {
      // The probe used the template's name; ids may also be accepted.
      Template: slot.templateName || slot.templateId,
      NewLayout: Object.assign(cls(s.layout), {
        Name: slot.name,
        Publication: ctx.publication,
        Issue: ctx.issue,
        PubChannel: ctx.pubChannel,
        Section: ctx.section,
        Pages: pages,
        // Status is deliberately never sent: the SDK docs state that object
        // state is determined by the editorial system, not the plan system.
      }),
    });
  }

  // Create many layouts in one request — CreateLayouts takes an array, so a
  // whole issue can go up at once.
  function createLayouts(slots, ctx) {
    var payload = { Layouts: slots.map(function (slot) { return buildLayoutFromTemplate(slot, ctx); }) };
    return callPlanning('CreateLayouts', payload).then(function (r) {
      return (r && r.Layouts) || [];
    });
  }

  // Does the endpoint accept our session at all? An empty Layouts array is a
  // no-op that still exercises authentication, so this has no side effects.
  function checkPlanningAccess() {
    return callPlanning('CreateLayouts', { Layouts: [] })
      .then(function () { return true; })
      .catch(function (e) {
        console.warn(TAG + ' planning access check failed: ' + e.message);
        return false;
      });
  }

  // One-off: work out which __classname__ strategy this server wants by
  // creating a single throwaway layout. Sets `strategy` on success. Exposed on
  // the debug object rather than run automatically — it creates a real object.
  function confirmProtocol(slot, ctx) {
    var order = ['bare', 'pln', 'none'];
    var attempt = 0;
    function next() {
      if (attempt >= order.length) {
        return Promise.reject(new Error('No __classname__ strategy worked; see console for each error.'));
      }
      var candidate = order[attempt++];
      var previous = strategy;
      strategy = candidate;
      return createLayouts([slot], ctx).then(function (layouts) {
        if (!layouts.length || !layouts[0].Id) {
          console.warn(TAG + ' strategy "' + candidate + '" accepted but returned no layout');
          strategy = previous;
          return next();
        }
        console.info(TAG + ' __classname__ strategy confirmed: "' + candidate + '"', layouts[0]);
        return { strategy: candidate, layout: layouts[0] };
      }).catch(function (e) {
        console.warn(TAG + ' strategy "' + candidate + '" -> ' + e.message);
        strategy = previous;
        return next();
      });
    }
    return next();
  }
