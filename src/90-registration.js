  // ─── Registration & lifecycle ──────────────────────────────────────────────
  // The action is created hidden and only revealed once the access check
  // passes, because createAction has to happen while the menu is being built —
  // registering later, after an async check, is not reliable.
  var actionId = null;
  try {
    if (PoUiSdk.hasActions()) PoUiSdk.createAction(); // separator below other plug-ins
    actionId = PoUiSdk.createAction({
      label: 'Create pages…',
      visible: false,
      click: function () {
        if (!accessState.allowed) return; // belt and braces
        try { openPlannerDialog(); }
        catch (e) {
          console.error(TAG + ' planner dialog failed:', e);
          notify('Issue Creator failed to open: ' + e.message, 'error');
        }
      },
    });
  } catch (e) {
    console.error(TAG + ' could not register menu action:', e);
  }

  checkAccess().then(function (allowed) {
    if (!allowed || !actionId) return;
    try { PoUiSdk.changeAction(actionId, { visible: true }); }
    catch (e) { console.error(TAG + ' could not reveal the menu action:', e); }
  });

  // Console diagnostics: window.__issueCreator
  window.__issueCreator = {
    version: VERSION,
    settings: loadSettings,
    saveSettings: saveSettings,
    currentFilter: currentFilter,
    loadContextNames: loadContextNames,
    loadIssueModel: loadIssueModel,
    loadTemplates: loadTemplates,
    checkPlanningAccess: checkPlanningAccess,
    confirmProtocol: confirmProtocol,
    createLayouts: createLayouts,
    applyPattern: applyPattern,
    nameSlots: nameSlots,
    open: openPlannerDialog,
    strategy: function () { return strategy; },
    grid: grid,
    plannedSlots: plannedSlots,
    gridCounts: gridCounts,
    loadThumbUrls: loadThumbUrls,
    moveAssignment: moveAssignment,
    serializeArrangement: serializeArrangement,
    applyArrangement: applyArrangement,
    setAllIncluded: setAllIncluded,
    listIssueTemplates: listIssueTemplates,
    saveIssueTemplate: saveIssueTemplate,
    savePlanDraft: savePlanDraft,
    loadPlanDraft: loadPlanDraft,
    access: function () { return accessState; },
    checkAccess: checkAccess,
    // Server-specific: adjust if the admin group is named differently here.
    // Takes effect on the next page load.
    setAdminGroups: function (groups) {
      var s = loadSettings();
      s.adminGroups = groups;
      saveSettings(s);
      console.info(TAG + ' admin groups set to [' + groups.join(', ') + ']; reload Studio to apply.');
    },
  };

  console.info(TAG + ' v' + VERSION + ' loaded');
