  // ─── Saved arrangements ────────────────────────────────────────────────────
  // Two kinds, both stored *in Studio* so they are visible to everyone rather
  // than trapped in one person's browser:
  //
  //   Issue template — a named, reusable arrangement of templates in a specific
  //     order, not tied to any issue. `IssueTemplate_<name>` in `_Issue Templates`.
  //   Plan draft     — work in progress on one specific issue, saved without
  //     creating anything. `IssuePlan_<issueId>` in `_Issue Plans`, one per
  //     issue, overwritten on each save.
  //
  // The PoC proved this shape server-side: object type `Other`, format
  // text/plain, contained in a dossier, with the bytes uploaded to the Transfer
  // Server first and referenced by FileUrl.
  //
  // Sending the JSON inline as base64 in the Attachment's Content was tried
  // first, to avoid a second endpoint — the server rejects it with "Unable to
  // save attached data to file (S1001)". So the Transfer Server it is; the only
  // new part versus the PoC is authenticating with the cookie session (ww-app)
  // instead of a ticket.

  var ISSUE_TEMPLATE_DOSSIER = '_Issue Templates';
  var ISSUE_TEMPLATE_PREFIX = 'IssueTemplate_';
  var PLAN_DOSSIER = '_Issue Plans';
  var PLAN_PREFIX = 'IssuePlan_';

  // Only needed for reading: a server that hands content back inline. atob() is
  // latin-1, so go via UTF-8 bytes or template names with accents come back
  // mangled.
  function fromBase64(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // Upload bytes to the Transfer Server and return a FileUrl usable in an
  // Attachment. A ticket is used when the session has one; otherwise ww-app
  // makes the session cookie apply, the same trick that lets rendition
  // downloads work from the browser.
  function uploadToTransfer(text, mime) {
    var guid = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
        });

    var base = serverUrl('transferindex.php');
    var ticket = getTicket();
    var auth = ticket ? 'ticket=' + encodeURIComponent(ticket) : 'ww-app=' + encodeURIComponent(WW_APP);
    var uploadUrl = base + '?' + auth + '&fileguid=' + encodeURIComponent(guid) +
      '&format=' + encodeURIComponent(mime);
    var blob = new Blob([text], { type: mime });

    function attempt(method) {
      return fetch(uploadUrl, {
        method: method,
        credentials: 'same-origin',
        headers: Object.assign({ 'Content-Type': mime }, WW_APP_HEADER),
        body: blob,
      });
    }

    // Some proxies refuse PUT; the PoC carried the same POST fallback.
    return attempt('PUT').then(function (res) {
      if (res.ok) return res;
      return attempt('POST');
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (body) {
          throw new Error('Transfer upload failed: HTTP ' + res.status + ' ' + String(body).slice(0, 200));
        });
      }
      return base + '?fileguid=' + encodeURIComponent(guid) + '&format=' + encodeURIComponent(mime);
    });
  }

  function findObjectsByName(publicationId, name, operation) {
    return callServer('QueryObjects', {
      Params: [
        { __classname__: 'QueryParam', Property: 'Type', Operation: '=', Value: 'Other' },
        { __classname__: 'QueryParam', Property: 'PublicationId', Operation: '=', Value: String(publicationId) },
        { __classname__: 'QueryParam', Property: 'Name', Operation: operation || '=', Value: name },
      ],
      FirstEntry: 1, MaxEntries: 200, Hierarchical: false, Order: [],
      MinimalProps: ['ID', 'Name', 'Modified', 'Modifier'],
      RequestProps: null, Areas: ['Workflow'], GetHidden: false,
    }).then(function (r) {
      var cols = (r.Columns || []).map(function (c) { return c.Name; });
      return (r.Rows || []).map(function (row) {
        var o = {};
        for (var i = 0; i < cols.length; i++) o[cols[i]] = row[i];
        return { id: String(o.ID), name: o.Name, modified: o.Modified, modifier: o.Modifier };
      });
    });
  }

  function findOrCreateDossier(name, publicationId, categoryId) {
    return callServer('QueryObjects', {
      Params: [
        { __classname__: 'QueryParam', Property: 'Type', Operation: '=', Value: 'Dossier' },
        { __classname__: 'QueryParam', Property: 'PublicationId', Operation: '=', Value: String(publicationId) },
        { __classname__: 'QueryParam', Property: 'Name', Operation: '=', Value: name },
      ],
      FirstEntry: 1, MaxEntries: 1, Hierarchical: false, Order: [],
      MinimalProps: ['ID', 'Name'], RequestProps: null, Areas: ['Workflow'], GetHidden: false,
    }).then(function (r) {
      if ((r.Rows || []).length) return String(r.Rows[0][0]);
      return callServer('CreateObjects', {
        Lock: false, Messages: null, AutoNaming: false, ReplaceGUIDs: null,
        Objects: [{
          __classname__: 'Object',
          MetaData: {
            __classname__: 'MetaData',
            BasicMetaData: {
              __classname__: 'BasicMetaData',
              ID: '', Name: name, Type: 'Dossier',
              Publication: { __classname__: 'Publication', Id: String(publicationId) },
              Category: { __classname__: 'Category', Id: String(categoryId) },
            },
          },
        }],
      }).then(function (res) {
        var obj = (res.Objects || [])[0];
        if (!obj) throw new Error('Could not create the "' + name + '" dossier');
        return String(obj.MetaData.BasicMetaData.ID);
      });
    });
  }

  function deleteObjects(ids) {
    if (!ids.length) return Promise.resolve();
    return callServer('DeleteObjects', {
      IDs: ids.map(String), Permanent: true, Params: null, Areas: ['Workflow'],
    });
  }

  function saveJsonObject(name, publicationId, categoryId, dossierName, data) {
    var json = JSON.stringify(data, null, 2);
    return Promise.all([
      findOrCreateDossier(dossierName, publicationId, categoryId),
      uploadToTransfer(json, 'text/plain'),
    ]).then(function (r) {
      var dossierId = r[0];
      var fileUrl = r[1];
      return callServer('CreateObjects', {
        Lock: false, Messages: null, AutoNaming: false, ReplaceGUIDs: null,
        Objects: [{
          __classname__: 'Object',
          MetaData: {
            __classname__: 'MetaData',
            BasicMetaData: {
              __classname__: 'BasicMetaData',
              ID: '', Name: name, Type: 'Other',
              Publication: { __classname__: 'Publication', Id: String(publicationId) },
              Category: { __classname__: 'Category', Id: String(categoryId) },
            },
          },
          Files: [{
            __classname__: 'Attachment',
            Rendition: 'native',
            Type: 'text/plain',
            FileUrl: fileUrl,
          }],
        }],
      }).then(function (res) {
        var obj = (res.Objects || [])[0];
        if (!obj) throw new Error('Save returned no object');
        var id = String(obj.MetaData.BasicMetaData.ID);
        return callServer('CreateObjectRelations', {
          Relations: [{ __classname__: 'Relation', Parent: String(dossierId), Child: id, Type: 'Contained' }],
        }).then(function () { return { id: id, name: name }; });
      });
    });
  }

  function loadJsonObject(objectId) {
    return callServer('GetObjects', {
      IDs: [String(objectId)], Lock: false, Rendition: 'native', RequestInfo: [],
      HaveVersions: null, Areas: null, EditionId: null, SupportedContentSources: null,
    }).then(function (r) {
      var obj = (r.Objects || [])[0];
      var files = (obj && obj.Files) || [];
      for (var i = 0; i < files.length; i++) {
        if (files[i].Content) return JSON.parse(fromBase64(files[i].Content));
      }
      // Some servers hand back a URL rather than inline content.
      for (var j = 0; j < files.length; j++) {
        if (files[j].FileUrl) {
          return fetch(withWwApp(files[j].FileUrl), { credentials: 'same-origin' })
            .then(function (res) {
              if (!res.ok) throw new Error('Could not download the saved plan: HTTP ' + res.status);
              return res.json();
            });
        }
      }
      throw new Error('Saved object ' + objectId + ' has no readable content');
    });
  }

  // ── issue templates (named, reusable, not tied to an issue) ────────────────

  function listIssueTemplates(publicationId) {
    return findObjectsByName(publicationId, ISSUE_TEMPLATE_PREFIX, 'starts').then(function (rows) {
      return rows.map(function (r) {
        return {
          id: r.id, name: r.name.replace(ISSUE_TEMPLATE_PREFIX, ''),
          modified: r.modified, modifier: r.modifier,
        };
      });
    });
  }

  function saveIssueTemplate(publicationId, categoryId, name, config) {
    var objName = ISSUE_TEMPLATE_PREFIX + name;
    // Overwrite rather than accumulate duplicates under the same name.
    return findObjectsByName(publicationId, objName, '=').then(function (existing) {
      return deleteObjects(existing.map(function (e) { return e.id; }));
    }).then(function () {
      return saveJsonObject(objName, publicationId, categoryId, ISSUE_TEMPLATE_DOSSIER, config);
    });
  }

  // ── plan versions (no pages created) ──────────────────────────────────────
  // Each save is its own object, so any earlier one can be restored:
  //
  //   IssuePlan_<issueId>_v<N>_<YYYY-MM-DD>
  //
  // The date comes from the browser at save time, deliberately. Studio's own
  // `Modified` is in the server's timezone with no offset marker — UTC-4 here —
  // so listing versions by it showed times hours adrift. Baking the date into
  // the name at the point of saving sidesteps the question rather than guessing
  // an offset, and a date alone is what you actually want when picking a version.

  function localDateStamp(d) {
    d = d || new Date();
    function two(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  // `IssuePlan_284_v3_2026-08-05` -> { version: 3, date: '2026-08-05' }
  // Plans saved before versioning have no suffix and are reported as version 0.
  function parsePlanName(name, issueId) {
    var prefix = PLAN_PREFIX + issueId;
    if (name === prefix) return { version: 0, date: '', legacy: true };
    var m = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '_v(\\d+)(?:_(\\d{4}-\\d{2}-\\d{2}))?$').exec(name);
    if (!m) return null;
    return { version: Number(m[1]), date: m[2] || '', legacy: false };
  }

  // Newest first.
  function listPlanVersions(publicationId, issueId) {
    return findObjectsByName(publicationId, PLAN_PREFIX + issueId, 'starts').then(function (rows) {
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var parsed = parsePlanName(rows[i].name, issueId);
        if (!parsed) continue; // a different issue whose id starts the same way
        out.push({
          id: rows[i].id, name: rows[i].name,
          version: parsed.version, date: parsed.date, legacy: parsed.legacy,
          savedBy: rows[i].modifier, modified: rows[i].modified,
        });
      }
      out.sort(function (a, b) { return b.version - a.version; });
      return out;
    });
  }

  function savePlanVersion(publicationId, categoryId, issueId, config) {
    var keep = loadSettings().planVersionsToKeep;
    return listPlanVersions(publicationId, issueId).then(function (versions) {
      var next = versions.length ? versions[0].version + 1 : 1;
      var stamp = localDateStamp();
      var objName = PLAN_PREFIX + issueId + '_v' + next + '_' + stamp;
      config.version = next;
      config.savedDate = stamp;
      return saveJsonObject(objName, publicationId, categoryId, PLAN_DOSSIER, config)
        .then(function (saved) {
          // Prune oldest beyond the cap, so a long-running issue does not fill
          // the dossier. Best effort: a failed prune must not fail the save.
          if (!keep || versions.length + 1 <= keep) return { saved: saved, version: next, date: stamp };
          var excess = versions.slice(keep - 1); // newest kept are versions[0..keep-2] plus the new one
          return deleteObjects(excess.map(function (v) { return v.id; }))
            .catch(function (e) { console.warn(TAG + ' could not prune old plan versions: ' + e.message); })
            .then(function () { return { saved: saved, version: next, date: stamp, pruned: excess.length }; });
        });
    });
  }

  function loadPlanVersion(objectId) { return loadJsonObject(objectId); }
