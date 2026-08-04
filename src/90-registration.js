  // ─── Registration & lifecycle ──────────────────────────────────────────────
  try {
    if (PoUiSdk.hasActions()) PoUiSdk.createAction(); // separator below other plug-ins
    PoUiSdk.createAction({
      label: 'Create pages…',
      click: function () {
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
  };

  console.info(TAG + ' v' + VERSION + ' loaded');
