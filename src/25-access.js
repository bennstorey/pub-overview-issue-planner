  // ─── Access check ──────────────────────────────────────────────────────────
  // Restricts the tool to administrators.
  //
  // IMPORTANT: this is not a security boundary. The bundle is fetched from a
  // public URL and runs in the user's own browser, so anyone determined can edit
  // it out or call the Planning API directly. What actually stops a non-admin
  // creating pages is Studio's own access rights — the server refuses the calls.
  // This check keeps the menu entry out of the way of people who have no
  // business using it, which is a usability guarantee, not a security one.

  var accessState = { checked: false, allowed: false, user: null, groups: [] };

  function loadUserProfile() {
    return callServer('GetUserProfile', { RequestInfo: ['Memberships'] }).then(function (r) {
      var user = r.CurrentUser || {};
      var groups = (r.Memberships || []).map(function (g) { return g.Name; });
      return { user: user, groups: groups };
    });
  }

  // Group names vary between servers, so the list is a setting rather than a
  // constant — see DEFAULTS.adminGroups.
  function isAdminGroup(name, adminGroups) {
    var n = String(name || '').trim().toLowerCase();
    for (var i = 0; i < adminGroups.length; i++) {
      if (n === String(adminGroups[i]).trim().toLowerCase()) return true;
    }
    return false;
  }

  function checkAccess() {
    var adminGroups = loadSettings().adminGroups || [];
    return loadUserProfile().then(function (profile) {
      var allowed = false;
      for (var i = 0; i < profile.groups.length; i++) {
        if (isAdminGroup(profile.groups[i], adminGroups)) { allowed = true; break; }
      }
      accessState = {
        checked: true, allowed: allowed,
        user: profile.user, groups: profile.groups,
      };
      if (!allowed) {
        console.info(TAG + ' hidden: ' + (profile.user.UserID || 'this user') +
          ' is in [' + profile.groups.join(', ') + '], none of which is an admin group [' +
          adminGroups.join(', ') + ']. Adjust with ' +
          '__issueCreator.setAdminGroups([...]) if this server names them differently.');
      }
      return allowed;
    }).catch(function (e) {
      // Fail closed: a restriction that opens up when the check breaks is not a
      // restriction. Logged loudly so it is diagnosable rather than mysterious.
      accessState = { checked: true, allowed: false, user: null, groups: [], error: e.message };
      console.warn(TAG + ' access check failed, staying hidden: ' + e.message);
      return false;
    });
  }
