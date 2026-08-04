  // ─── Issue data ────────────────────────────────────────────────────────────
  // GetPagesInfo is the service Publication Overview itself renders from, so it
  // is the authority on which pages of the issue are already occupied — and on
  // where a created layout actually lands. Probe layout 87902 confirmed that
  // position here follows the planning data, not the INDD's own numbering.

  function loadIssueModel(issueId, editionId) {
    return callServer('GetPagesInfo', {
      Issue: { Id: String(issueId), __classname__: 'Issue' },
      IDs: null,
      Edition: editionId ? { Id: String(editionId), __classname__: 'Edition' } : null,
      Category: null,
      State: null,
    }).then(function (r) {
      var layouts = {};
      var los = r.LayoutObjects || [];
      for (var i = 0; i < los.length; i++) {
        var lo = los[i];
        layouts[String(lo.Id)] = {
          id: String(lo.Id),
          name: lo.Name,
          stateName: (lo.State && lo.State.Name) || '',
          lockedBy: lo.LockedBy || '',
        };
      }

      var pages = [];
      var eps = r.EditionsPages || [];
      for (var e = 0; e < eps.length; e++) {
        var pos = eps[e].PageObjects || [];
        for (var p = 0; p < pos.length; p++) {
          var po = pos[p];
          pages.push({
            layoutId: String(po.ParentLayoutId),
            pageOrder: Number(po.PageOrder),
            pageNumber: String(po.PageNumber),
            pageSequence: Number(po.PageSequence),
          });
        }
      }
      pages.sort(function (a, b) { return a.pageOrder - b.pageOrder || a.pageSequence - b.pageSequence; });

      return {
        issueId: String(issueId),
        editionId: editionId ? String(editionId) : null,
        expectedPages: Number(r.ExpectedPages) || 0,
        layouts: layouts,
        pages: pages,
        occupied: pages.reduce(function (set, pg) { set[pg.pageOrder] = pg.layoutId; return set; }, {}),
      };
    });
  }

  // Names are what the Planning API identifies brand/issue/channel/section by,
  // and currentFilterSetting() only gives ids — so resolve them once.
  //
  // The brand is deliberately resolved by finding which publication actually
  // contains the issue, rather than trusting a brand id off the filter. The
  // filter's key for it is undocumented and was not `brandId` on this server,
  // and guessing wrong is silently catastrophic: PublicationIds null returns
  // every brand, and taking the first gives a plausible-looking but completely
  // unrelated brand.
  function findIssue(publications, issueId) {
    for (var p = 0; p < publications.length; p++) {
      var pub = publications[p];
      var chans = pub.PubChannels || [];
      for (var c = 0; c < chans.length; c++) {
        var issues = chans[c].Issues || [];
        for (var i = 0; i < issues.length; i++) {
          if (String(issues[i].Id) === String(issueId)) {
            return { pub: pub, channel: chans[c], issue: issues[i] };
          }
        }
      }
    }
    return null;
  }

  function loadContextNames(filter) {
    // Whatever the filter calls the brand, use it as a hint to keep the common
    // case to one small response; fall back to every brand if the issue is not
    // in there.
    var hint = filter.brandId || filter.publicationId || filter.pubId || filter.brand || null;
    var request = { RequestInfo: ['PubChannels', 'Issues', 'Categories'] };

    function fetchPubs(ids) {
      return callServer('GetPublications', Object.assign({ PublicationIds: ids }, request))
        .then(function (r) { return r.Publications || []; });
    }

    return fetchPubs(hint ? [String(hint)] : null).then(function (pubs) {
      var found = findIssue(pubs, filter.issueId);
      if (found) return found;
      // Hint was absent, wrong, or pointed at a brand without this issue.
      if (hint) {
        return fetchPubs(null).then(function (all) { return findIssue(all, filter.issueId); });
      }
      return null;
    }).then(function (found) {
      if (!found) throw new Error('Could not find issue ' + filter.issueId + ' in any brand you can read');

      // Section is Studio's Category. The user may be filtered to "All
      // categories", in which case there is nothing to infer — but created
      // layouts still need one, so fall back to the brand's first and say so
      // rather than choosing silently.
      var cats = found.pub.Categories || [];
      var sectionName = '';
      var defaulted = false;
      for (var k = 0; k < cats.length; k++) {
        if (String(cats[k].Id) === String(filter.categoryId)) { sectionName = cats[k].Name; break; }
      }
      if (!sectionName && cats.length) { sectionName = cats[0].Name; defaulted = true; }

      return {
        publication: found.pub.Name,
        publicationId: String(found.pub.Id),
        issue: found.issue.Name,
        issueId: String(found.issue.Id),
        pubChannel: found.channel.Name,
        pubChannelId: String(found.channel.Id),
        section: sectionName,
        sectionDefaulted: defaulted,
        categories: cats.map(function (c) { return { id: String(c.Id), name: c.Name }; }),
      };
    });
  }
