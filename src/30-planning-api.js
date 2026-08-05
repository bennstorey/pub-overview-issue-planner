  // ─── Planning API (editorialplan.php) ─────────────────────────────────────
  // CreateLayouts instantiates layouts from their templates with the page plan
  // already applied — Page.PageOrder is the real page number. This replaces the
  // old PoC pipeline entirely (download native -> upload to transfer server ->
  // CreateObjects -> relate -> target -> renumber via local InDesign).
  //
  // Studio's JSON-RPC is strongly typed: nested objects need a __classname__ or
  // the deserializer drops every field and reports them as unspecified. The
  // planning interface's type names are not in the SDK docs; confirmProtocol()
  // established them against Studio 10.67 by trying each in turn.
  //
  // CONFIRMED 2026-08-04: this server wants the Pln-prefixed names. The bare
  // names that the workflow interface uses are rejected here, so the two
  // interfaces do not share a convention despite sharing the field names.

  var CLASSNAME_STRATEGIES = {
    // Confirmed on Studio 10.67; matches the PlnLayout that comes back in the
    // CreateLayouts response.
    pln: { fromTemplate: 'PlnLayoutFromTemplate', layout: 'PlnLayout', page: 'PlnPage' },
    // The workflow interface's convention. Rejected by the planning endpoint on
    // 10.67; kept in case another version differs.
    bare: { fromTemplate: 'LayoutFromTemplate', layout: 'Layout', page: 'Page' },
    // No markers at all — known to fail, kept so confirmProtocol can prove it.
    none: { fromTemplate: null, layout: null, page: null },
  };

  // Confirmed default, overridden by whatever this origin last found to work —
  // localStorage is per-origin, so each Studio instance remembers its own.
  var strategy = (function () {
    try {
      var saved = loadSettings().classnameStrategy;
      return (saved && CLASSNAME_STRATEGIES[saved]) ? saved : 'pln';
    } catch (e) { return 'pln'; }
  }());

  function cls(name) { return name ? { __classname__: name } : {}; }

  // slot: { page, pageEnd, templateId, templateName, name, section }
  // ctx:  { publication, issue, pubChannel, section }
  //
  // Section (Studio's Category) comes from the slot's own template — a layout
  // built from the News template belongs in News — and falls back to the
  // context's section only when the template has no category of its own.
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
        Section: slot.section || ctx.section,
        Pages: pages,
        // Status is deliberately never sent: the SDK docs state that object
        // state is determined by the editorial system, not the plan system.
      }),
    });
  }

  // Create many layouts in one request — CreateLayouts takes an array, so a
  // whole issue can go up at once.
  //
  // Note the response's Layouts carry Id, Name and the resolved
  // Publication/Issue/PubChannel/Section/Status, but `Pages` comes back null.
  // So the response cannot confirm the page plan landed: verify with
  // loadIssueModel() or by reading PlannedPageRange afterwards.
  function createLayouts(slots, ctx) {
    return attemptCreate(slots, ctx, strategy).catch(function (err) {
      // The type names are a Studio *version* dependency, not an instance one,
      // so a bundle proven on 10.67 may meet a server that wants different ones.
      // Retry across the alternatives, but only on the signature of a
      // deserialization failure — where nothing was created. Retrying a
      // genuine failure (a name clash, say) could duplicate work.
      if (!looksLikeClassnameMismatch(err)) throw err;

      var alternatives = Object.keys(CLASSNAME_STRATEGIES).filter(function (k) { return k !== strategy; });
      console.warn(TAG + ' CreateLayouts rejected with strategy "' + strategy +
        '" — trying ' + alternatives.join(', ') + '. Original error: ' + err.message);

      function next(i) {
        if (i >= alternatives.length) throw err; // report the original failure
        var candidate = alternatives[i];
        return attemptCreate(slots, ctx, candidate).then(function (layouts) {
          strategy = candidate; // remember for the rest of this session
          rememberStrategy(candidate);
          console.info(TAG + ' this server wants __classname__ strategy "' + candidate + '"');
          return layouts;
        }).catch(function (e) {
          if (!looksLikeClassnameMismatch(e)) throw e;
          return next(i + 1);
        });
      }
      return next(0);
    });
  }

  function attemptCreate(slots, ctx, useStrategy) {
    var previous = strategy;
    strategy = useStrategy;
    var payload;
    try {
      payload = { Layouts: slots.map(function (slot) { return buildLayoutFromTemplate(slot, ctx); }) };
    } finally {
      strategy = previous;
    }
    return callPlanning('CreateLayouts', payload).then(function (r) {
      return (r && r.Layouts) || [];
    });
  }

  // A wrong __classname__ makes the deserializer drop every field, so the server
  // complains that required values are absent even though they were all sent.
  function looksLikeClassnameMismatch(err) {
    return /not specified|missing function parameter|S1000/i.test(String(err && err.message));
  }

  function rememberStrategy(name) {
    try {
      var s = loadSettings();
      s.classnameStrategy = name;
      saveSettings(s);
    } catch (e) { /* a cached preference is a nicety, not a requirement */ }
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
    var order = ['pln', 'bare', 'none'];
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
