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
  function loadContextNames(filter) {
    return callServer('GetPublications', {
      PublicationIds: filter.brandId ? [String(filter.brandId)] : null,
      RequestInfo: ['PubChannels', 'Issues', 'Categories'],
    }).then(function (r) {
      var pub = (r.Publications || [])[0];
      if (!pub) throw new Error('Brand ' + filter.brandId + ' not readable');

      var channelName = '';
      var issueName = '';
      var chans = pub.PubChannels || [];
      for (var c = 0; c < chans.length && !issueName; c++) {
        var issues = chans[c].Issues || [];
        for (var i = 0; i < issues.length; i++) {
          if (String(issues[i].Id) === String(filter.issueId)) {
            issueName = issues[i].Name;
            channelName = chans[c].Name;
            break;
          }
        }
      }

      var sectionName = '';
      var cats = pub.Categories || [];
      for (var k = 0; k < cats.length; k++) {
        if (String(cats[k].Id) === String(filter.categoryId)) { sectionName = cats[k].Name; break; }
      }

      return {
        publication: pub.Name,
        publicationId: String(pub.Id),
        issue: issueName,
        pubChannel: channelName,
        section: sectionName,
      };
    });
  }
