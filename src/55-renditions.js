  // ─── Thumbnails ────────────────────────────────────────────────────────────
  // Studio's rendition FileUrls point at the Transfer Server, which returns
  // HTTP 400 ("Please specify ticket param") unless ww-app is present — with it,
  // the session cookie applies. Same quirk the PDF plug-in documents, and it
  // means an <img src> works directly without fetching bytes ourselves.

  var thumbCache = {}; // objectId -> url | null

  function withWwApp(url) {
    if (url.indexOf('ww-app=') !== -1) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ww-app=' + encodeURIComponent(WW_APP);
  }

  // Returns { id: url } for the ids it could resolve. Cached, so re-rendering
  // the grid is free and only genuinely new ids cost a request.
  function loadThumbUrls(ids) {
    var wanted = [];
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      if (id && !(id in thumbCache) && wanted.indexOf(id) === -1) wanted.push(id);
    }
    if (!wanted.length) return Promise.resolve(pickCached(ids));

    return callServer('GetObjects', {
      IDs: wanted,
      Lock: false,
      Rendition: 'thumb',
      RequestInfo: [],
      HaveVersions: null,
      Areas: null,
      EditionId: null,
      SupportedContentSources: null,
    }).then(function (r) {
      var objs = r.Objects || [];
      for (var o = 0; o < objs.length; o++) {
        var obj = objs[o];
        var oid = obj.MetaData && obj.MetaData.BasicMetaData && String(obj.MetaData.BasicMetaData.ID);
        if (!oid) continue;
        var url = null;
        var files = obj.Files || [];
        for (var f = 0; f < files.length; f++) {
          if (files[f].Rendition === 'thumb' && files[f].FileUrl) { url = withWwApp(files[f].FileUrl); break; }
        }
        thumbCache[oid] = url;
      }
      // Anything the server did not return gets a negative entry so we stop asking.
      for (var w = 0; w < wanted.length; w++) {
        if (!(wanted[w] in thumbCache)) thumbCache[wanted[w]] = null;
      }
      return pickCached(ids);
    }).catch(function (e) {
      console.warn(TAG + ' thumbnail load failed: ' + e.message);
      for (var w2 = 0; w2 < wanted.length; w2++) thumbCache[wanted[w2]] = null;
      return pickCached(ids);
    });
  }

  function pickCached(ids) {
    var out = {};
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      if (thumbCache[id]) out[id] = thumbCache[id];
    }
    return out;
  }

  function thumbUrl(id) { return thumbCache[String(id)] || null; }

  // ── Per-page thumbnails ───────────────────────────────────────────────────
  // An object's own 'thumb' rendition is a single image — for a multi-page
  // layout that is just its first spread, so a 4-page template appears to be
  // 2 pages. RequestInfo ['Pages'] returns a thumb per page instead, which is
  // what a spread slot should show.

  var pageThumbCache = {}; // objectId -> [url] | null

  function loadPageThumbUrls(ids) {
    var wanted = [];
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      if (id && !(id in pageThumbCache) && wanted.indexOf(id) === -1) wanted.push(id);
    }
    if (!wanted.length) return Promise.resolve();

    return callServer('GetObjects', {
      IDs: wanted,
      Lock: false,
      Rendition: 'thumb',
      RequestInfo: ['Pages'],
      HaveVersions: null,
      Areas: null,
      EditionId: null,
      SupportedContentSources: null,
    }).then(function (r) {
      var objs = r.Objects || [];
      for (var o = 0; o < objs.length; o++) {
        var obj = objs[o];
        var oid = obj.MetaData && obj.MetaData.BasicMetaData && String(obj.MetaData.BasicMetaData.ID);
        if (!oid) continue;
        var pages = (obj.Pages || []).slice().sort(function (a, b) {
          return (Number(a.PageOrder) || 0) - (Number(b.PageOrder) || 0);
        });
        var urls = [];
        for (var p = 0; p < pages.length; p++) {
          var files = pages[p].Files || [];
          for (var f = 0; f < files.length; f++) {
            if (files[f].Rendition === 'thumb' && files[f].FileUrl) { urls.push(withWwApp(files[f].FileUrl)); break; }
          }
        }
        pageThumbCache[oid] = urls.length ? urls : null;
      }
      for (var w = 0; w < wanted.length; w++) {
        if (!(wanted[w] in pageThumbCache)) pageThumbCache[wanted[w]] = null;
      }
    }).catch(function (e) {
      console.warn(TAG + ' per-page thumbnail load failed: ' + e.message);
      for (var w2 = 0; w2 < wanted.length; w2++) pageThumbCache[wanted[w2]] = null;
    });
  }

  function pageThumbUrls(id) { return pageThumbCache[String(id)] || null; }
