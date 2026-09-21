// Macro: Quick Scene Swapper (Unified Scene & Module Manager V2)
// Verified against Foundry V14 ApplicationV2 / DialogV2
(async () => {
  const pack = game.packs.get("world.gygax75-scenes");
  if (!pack) return ui.notifications.error("Compendium pack 'world.gygax75-scenes' not found!");

  const PROTECTED_SCENES = [
    "Ingot Inn - Threshold",
    "Gemthrone Valley",
    "Combat",
    "TotM Combat w/ OSE Rules"
  ];

  const index = await pack.getIndex({ fields: ["name", "folder", "flags"] });
  if (index.size === 0) return ui.notifications.warn("No scenes found in 'world.gygax75-scenes' compendium.");

  // Build compendium folder maps
  const compFolderMap = {};
  const compFolderColorMap = {};
  for (const f of pack.folders) {
    compFolderMap[f.id] = f.name;
    if (f.color) compFolderColorMap[f.name] = f.color;
  }

  // Helper: Get or create world folder under "Justin Sites"
  async function getOrCreateWorldFolder(moduleName) {
    let worldFolder = game.folders.find(f => f.type === "Scene" && f.name === moduleName && !f.pack);
    if (!worldFolder) {
      const parent = game.folders.find(f => f.type === "Scene" && f.name === "Justin Sites" && !f.pack);
      const compFolder = pack.folders.find(f => f.name === moduleName);
      worldFolder = await Folder.create({
        name: moduleName,
        type: "Scene",
        folder: parent ? parent.id : null,
        color: compFolder?.color || compFolderColorMap[moduleName] || null
      });
    }
    return worldFolder;
  }

  // Helper: Clean up world folder if empty
  async function cleanEmptyWorldFolder(worldFolder) {
    if (!worldFolder) return;
    const remainingScenes = game.scenes.filter(s => s.folder?.id === worldFolder.id);
    const subfolders = game.folders.filter(f => f.folder?.id === worldFolder.id);
    if (remainingScenes.length === 0 && subfolders.length === 0) {
      await worldFolder.delete();
      console.log(`[Quick Scene Swapper] Deleted empty world folder: ${worldFolder.name}`);
    }
  }

  // Helper: Safe atomic scene offload to compendium
  async function offloadSceneDoc(scene, { silent = false } = {}) {
    if (!scene) return false;
    if (PROTECTED_SCENES.includes(scene.name)) {
      if (!silent) ui.notifications.warn(`"${scene.name}" is a permanent campaign hub and cannot be offloaded.`);
      return false;
    }

    let wasLocked = false;
    try {
      // 1. If currently active, switch to fallback scene first
      if (scene.active) {
        const fallback = game.scenes.getName("Ingot Inn - Threshold")
                      || game.scenes.find(s => PROTECTED_SCENES.includes(s.name) && s._id !== scene._id)
                      || game.scenes.find(s => s._id !== scene._id);
        if (!fallback) {
          ui.notifications.error(`Cannot offload active scene "${scene.name}": no fallback scene available in the world!`);
          return false;
        }

        if (!silent) ui.notifications.info(`Switching active scene to "${fallback.name}" before offloading...`);
        await fallback.activate();
        await new Promise(resolve => setTimeout(resolve, 200));

        if (scene.active) {
          ui.notifications.error(`Failed to deactivate "${scene.name}". Aborting offload.`);
          return false;
        }
      }

      // 2. Ensure compendium is unlocked
      wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked: false });

      // 3. Resolve module name & compendium folder
      const moduleName = scene.flags?.gygax75?.module || scene.folder?.name || "General / Other";
      let compFolder = pack.folders.find(f => f.name === moduleName);
      if (!compFolder && moduleName !== "General / Other") {
        compFolder = await Folder.create(
          { name: moduleName, type: "Scene", folder: null, color: scene.folder?.color || null },
          { pack: pack.collection }
        );
      }

      const isBrokenThumb = !scene.thumb || scene.thumb.includes("worlds/ose/") || scene.thumb.includes("forge-migration/");
      const updateData = {
        folder: compFolder ? compFolder.id : null,
        "flags.gygax75.module": moduleName,
        ...(isBrokenThumb ? { thumb: null } : {})
      };

      // 4. Overwrite in compendium preserving 16-char ID
      const existingInPack = await pack.getDocument(scene.id);
      if (existingInPack) {
        await existingInPack.delete();
      }

      await pack.importDocument(scene, {
        keepId: true,
        transform: (data) => foundry.utils.mergeObject(data, updateData)
      });

      // 5. Delete scene from world & clean empty folder
      const worldFolder = scene.folder;
      await scene.delete();
      await cleanEmptyWorldFolder(worldFolder);

      if (!silent) ui.notifications.info(`Successfully offloaded "${scene.name}" to Gygax75-Scenes compendium.`);
      return true;
    } catch (err) {
      console.error(`[Quick Scene Swapper] Failed to offload ${scene.name}:`, err);
      ui.notifications.error(`Failed to offload "${scene.name}": ${err.message}`);
      return false;
    } finally {
      if (wasLocked) {
        try {
          await pack.configure({ locked: true });
        } catch (e) {
          console.warn("Failed to re-lock compendium pack:", e);
        }
      }
    }
  }

  // Helper: Single Scene Activation / Import
  async function activateScene(sceneId, moduleName) {
    try {
      const worldFolder = await getOrCreateWorldFolder(moduleName);

      let scene = game.scenes.get(sceneId);
      if (!scene) {
        scene = await game.scenes.importFromCompendium(pack, sceneId, { folder: worldFolder.id }, { keepId: true });
      } else if (scene.folder?.id !== worldFolder.id) {
        await scene.update({ folder: worldFolder.id });
      }

      await scene.activate();

      // Thumbnail self-healing fallback
      if (!scene.thumb || scene.thumb.includes("worlds/ose/") || scene.thumb.includes("forge-migration/")) {
        if (canvas.scene?.id === scene.id && !canvas.ready) {
          await new Promise(resolve => Hooks.once("canvasReady", resolve));
        }
        try {
          const { thumb } = await scene.createThumbnail();
          if (thumb) await scene.update({ thumb }, { diff: false });
        } catch (tErr) {
          console.warn(`[Quick Scene Swapper] Could not generate thumbnail for ${scene.name}:`, tErr);
        }
      }

      ui.notifications.info(`Activated [${moduleName}] ${scene.name}`);
      return scene;
    } catch (err) {
      console.error("Quick Scene Swapper error:", err);
      ui.notifications.error(`Failed to activate scene: ${err.message}`);
      return null;
    }
  }

  // Helper: Batch Import all scenes for a module
  async function loadModuleScenes(moduleName, scenes) {
    const worldFolder = await getOrCreateWorldFolder(moduleName);
    let imported = 0;
    for (const sc of scenes) {
      if (!game.scenes.get(sc._id)) {
        await game.scenes.importFromCompendium(pack, sc._id, { folder: worldFolder.id }, { keepId: true });
        imported++;
      }
    }
    ui.notifications.info(`Imported ${imported} scenes for [${moduleName}] into world sidebar.`);
  }

  // Helper: Batch Offload all loaded scenes for a module
  async function offloadModuleScenes(moduleName, scenes) {
    let offloaded = 0;
    for (const sc of scenes) {
      const worldScene = game.scenes.get(sc._id);
      if (worldScene && !PROTECTED_SCENES.includes(worldScene.name)) {
        const ok = await offloadSceneDoc(worldScene, { silent: true });
        if (ok) offloaded++;
      }
    }
    // Also sweep any scenes in world folder matching moduleName
    const remainingInFolder = game.scenes.filter(s => s.folder?.name === moduleName && !PROTECTED_SCENES.includes(s.name));
    for (const s of remainingInFolder) {
      const ok = await offloadSceneDoc(s, { silent: true });
      if (ok) offloaded++;
    }
    ui.notifications.info(`Offloaded ${offloaded} scenes from [${moduleName}] to compendium.`);
  }

  // Helper: Sweep all offloadable scenes in the world
  async function sweepWorld() {
    const offloadable = game.scenes.filter(s => !PROTECTED_SCENES.includes(s.name));
    if (offloadable.length === 0) {
      ui.notifications.info("World is already clean! Only permanent campaign hubs are loaded.");
      return;
    }
    let count = 0;
    for (const s of offloadable) {
      const ok = await offloadSceneDoc(s, { silent: true });
      if (ok) count++;
    }
    ui.notifications.info(`Swept world: successfully offloaded ${count} scenes to compendium.`);
  }

  // Group scenes by module
  function getGroupedScenes() {
    const grouped = {};
    for (const entry of index.values()) {
      const moduleName = (entry.flags?.gygax75?.module) || compFolderMap[entry.folder] || "General / Other";
      if (!grouped[moduleName]) grouped[moduleName] = [];
      grouped[moduleName].push(entry);
    }
    return grouped;
  }

  // Render module list HTML
  function buildModulesHtml(expandedSet = new Set()) {
    const grouped = getGroupedScenes();
    const sortedModules = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    let modulesHtml = "";

    for (const mod of sortedModules) {
      const scenes = grouped[mod].sort((a, b) => a.name.localeCompare(b.name));
      let sceneRowsHtml = "";
      let loadedCount = 0;

      for (const sc of scenes) {
        const worldScene = game.scenes.get(sc._id);
        const inWorld = !!worldScene;
        const isActive = worldScene?.active;
        const isProtected = PROTECTED_SCENES.includes(sc.name);

        if (inWorld) loadedCount++;

        let statusBadge = "";
        let actionButtons = "";

        if (isActive) {
          statusBadge = `<span style="background: #27ae60; color: #fff; font-size: 0.72em; padding: 2px 6px; border-radius: 3px; font-weight: bold; flex-shrink: 0;">Active</span>`;
          if (!isProtected) {
            actionButtons = `
              <button type="button" class="btn-offload-scene" data-scene-id="${sc._id}" data-module="${mod}" title="Offload to compendium">
                <i class="fas fa-box-archive"></i> Offload
              </button>
            `;
          }
        } else if (inWorld) {
          statusBadge = `<span style="background: #2980b9; color: #fff; font-size: 0.72em; padding: 2px 6px; border-radius: 3px; font-weight: bold; flex-shrink: 0;">In World</span>`;
          actionButtons = `
            <button type="button" class="btn-activate-scene" data-scene-id="${sc._id}" data-module="${mod}">Switch To</button>
            ${!isProtected ? `
              <button type="button" class="btn-offload-scene" data-scene-id="${sc._id}" data-module="${mod}" title="Offload to compendium">
                <i class="fas fa-box-archive"></i> Offload
              </button>
            ` : ""}
          `;
        } else {
          statusBadge = `<span style="background: rgba(255,255,255,0.1); color: #cbd5e0; font-size: 0.72em; padding: 2px 6px; border-radius: 3px; flex-shrink: 0;">Compendium</span>`;
          actionButtons = `
            <button type="button" class="btn-activate-scene" data-scene-id="${sc._id}" data-module="${mod}">Activate</button>
          `;
        }

        sceneRowsHtml += `
          <div class="scene-item" data-scene-id="${sc._id}" data-module="${mod}" tabindex="0">
            <div class="scene-item-title">
              <i class="fas fa-map-marked-alt scene-icon"></i>
              <span class="scene-name">${sc.name}</span>
            </div>
            <div class="scene-item-actions">
              ${statusBadge}
              ${actionButtons}
            </div>
          </div>
        `;
      }

      const isExpanded = expandedSet.has(mod);
      const modColor = compFolderColorMap[mod] || "#a0aec0";
      const unimportedCount = scenes.length - loadedCount;

      let moduleHeaderActions = "";
      if (unimportedCount > 0) {
        moduleHeaderActions += `
          <button type="button" class="btn-load-module" data-module="${mod}" title="Import all unimported scenes in this module to world sidebar">
            <i class="fas fa-file-import"></i> Load All (${unimportedCount})
          </button>
        `;
      }
      if (loadedCount > 0) {
        moduleHeaderActions += `
          <button type="button" class="btn-offload-module" data-module="${mod}" title="Offload all scenes in this module to compendium">
            <i class="fas fa-box-archive"></i> Offload All (${loadedCount})
          </button>
        `;
      }

      modulesHtml += `
        <div class="module-group" data-module-name="${mod.toLowerCase()}">
          <div class="module-header" data-module="${mod}">
            <div class="module-title">
              <span class="folder-toggle-icon">${isExpanded ? "▼" : "▶"}</span>
              <span class="module-color-dot" style="background: ${modColor};"></span>
              <span>${mod}</span>
              <span class="module-count">${scenes.length}</span>
              <span class="module-status-pill ${loadedCount === scenes.length ? "status-all-loaded" : loadedCount > 0 ? "status-partial" : ""}">
                ${loadedCount === scenes.length ? "All In World" : loadedCount > 0 ? `${loadedCount}/${scenes.length} In World` : "In Compendium"}
              </span>
            </div>
            <div class="module-header-actions">
              ${moduleHeaderActions}
            </div>
          </div>
          <div class="module-scenes-list" style="display: ${isExpanded ? "" : "none"};">
            ${sceneRowsHtml}
          </div>
        </div>
      `;
    }

    return modulesHtml;
  }

  const offloadableInWorld = game.scenes.filter(s => !PROTECTED_SCENES.includes(s.name));

  const dialogContent = `
    <style>
      .qss-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 8px;
        box-sizing: border-box;
      }
      .qss-toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
      }
      .qss-search {
        flex: 1;
        padding: 6px 10px;
        font-size: 0.92em;
        border-radius: 4px;
        box-sizing: border-box;
      }
      .qss-btn-toolbar {
        width: auto !important;
        height: 30px !important;
        line-height: 28px !important;
        padding: 0 10px !important;
        margin: 0 !important;
        font-size: 0.8em !important;
        white-space: nowrap;
        cursor: pointer;
        display: inline-flex !important;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
        border-radius: 3px;
        transition: filter 0.15s ease;
      }
      .qss-btn-toolbar:hover {
        filter: brightness(1.2);
      }
      .qss-btn-clean {
        background: #c0392b !important;
        color: #fff !important;
        font-weight: 600 !important;
        border: 1px solid #962d22 !important;
      }
      #scenesContainer {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-right: 4px;
      }
      .module-group {
        margin-bottom: 6px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 4px;
        overflow: hidden;
        background: rgba(0,0,0,0.25);
      }
      .module-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        background: rgba(255,255,255,0.06);
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease;
      }
      .module-header:hover {
        background: rgba(255,255,255,0.1);
      }
      .module-title {
        font-weight: bold;
        font-size: 0.92em;
        color: #e2d6b5;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .module-color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }
      .module-count {
        font-size: 0.75em;
        color: #a0aec0;
        background: rgba(0,0,0,0.4);
        padding: 1px 7px;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .module-status-pill {
        font-size: 0.72em;
        padding: 1px 7px;
        border-radius: 3px;
        background: rgba(255,255,255,0.08);
        color: #cbd5e0;
        font-weight: normal;
        flex-shrink: 0;
      }
      .module-status-pill.status-partial {
        background: rgba(41, 128, 185, 0.35);
        color: #63b3ed;
        font-weight: bold;
        border: 1px solid rgba(41, 128, 185, 0.5);
      }
      .module-status-pill.status-all-loaded {
        background: rgba(39, 174, 96, 0.3);
        color: #68d391;
        font-weight: bold;
        border: 1px solid rgba(39, 174, 96, 0.5);
      }
      .module-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .btn-load-module, .btn-offload-module {
        width: auto !important;
        height: 24px !important;
        line-height: 22px !important;
        padding: 0 8px !important;
        margin: 0 !important;
        font-size: 0.75em !important;
        font-weight: 600 !important;
        cursor: pointer;
        border-radius: 3px;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px;
        transition: filter 0.15s ease;
      }
      .btn-load-module {
        background: #27ae60 !important;
        color: #fff !important;
      }
      .btn-offload-module {
        background: #7f1d1d !important;
        color: #fca5a5 !important;
        border: 1px solid #991b1b !important;
      }
      .btn-load-module:hover, .btn-offload-module:hover {
        filter: brightness(1.25);
      }
      .scene-item {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        height: 34px !important;
        padding: 0 10px !important;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        cursor: pointer;
        transition: background 0.15s ease;
        box-sizing: border-box !important;
        font-size: 13px !important;
      }
      .scene-item:hover, .scene-item:focus {
        background: rgba(255,255,255,0.09) !important;
        outline: none;
      }
      .scene-item-title {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        flex: 1 !important;
        min-width: 0 !important;
        margin-right: 10px !important;
      }
      .scene-icon {
        color: #e2d6b5;
        font-size: 0.9em;
        width: 16px;
        text-align: center;
        flex-shrink: 0;
      }
      .scene-name {
        font-weight: 500;
        font-size: 0.92em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #f0f0f0;
      }
      .scene-item-actions {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        flex-shrink: 0 !important;
      }
      .btn-activate-scene, .btn-offload-scene {
        width: auto !important;
        height: 24px !important;
        line-height: 22px !important;
        padding: 0 8px !important;
        margin: 0 !important;
        font-size: 0.78em !important;
        font-weight: 600 !important;
        cursor: pointer;
        border-radius: 3px;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px;
        transition: filter 0.15s ease;
      }
      .btn-activate-scene:hover, .btn-offload-scene:hover {
        filter: brightness(1.25);
      }
      .btn-offload-scene {
        background: rgba(231, 76, 60, 0.25) !important;
        color: #ff8577 !important;
        border: 1px solid rgba(231, 76, 60, 0.4) !important;
      }
    </style>
    <div class="qss-container">
      <div class="qss-toolbar">
        <input type="search" id="sceneSearchInput" class="qss-search" 
               placeholder="🔍 Filter by module or scene name (e.g. Stonefast, B1, Level 1)..." autofocus />
        <button type="button" id="btnToggleAll" class="qss-btn-toolbar">
          <i class="fas fa-expand-alt"></i> <span>Expand All</span>
        </button>
        <button type="button" id="btnCleanWorld" class="qss-btn-toolbar qss-btn-clean" title="Offload all non-permanent scenes from world sidebar to compendium">
          <i class="fas fa-broom"></i> <span>Sweep World (${offloadableInWorld.length})</span>
        </button>
      </div>

      <div id="scenesContainer">
        ${buildModulesHtml()}
      </div>

      <div id="qssFooter" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8em; color: #a0aec0; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 4px; flex-shrink: 0;">
        <span>Active in sidebar: <i>${game.scenes.map(s => s.name).join(", ")}</i></span>
      </div>
    </div>
  `;

  const dialog = new foundry.applications.api.DialogV2({
    window: { title: "Quick Scene Swapper", resizable: true },
    classes: ["ose", "dialog"],
    position: { width: 680, height: 580 },
    content: dialogContent,
    buttons: [{
      action: "close",
      label: "Close"
    }]
  });

  dialog.addEventListener("render", () => {
    const root = dialog.element;
    const searchInput = root.querySelector("#sceneSearchInput");
    const container = root.querySelector("#scenesContainer");
    const toggleAllBtn = root.querySelector("#btnToggleAll");
    const cleanWorldBtn = root.querySelector("#btnCleanWorld");
    const footer = root.querySelector("#qssFooter");

    let allExpanded = false;
    const expandedModules = new Set();

    // Re-render scenes container in place while preserving expanded state
    function refreshView() {
      container.innerHTML = buildModulesHtml(expandedModules);
      const remainingOffloadable = game.scenes.filter(s => !PROTECTED_SCENES.includes(s.name));
      if (cleanWorldBtn) {
        cleanWorldBtn.innerHTML = `<i class="fas fa-broom"></i> <span>Sweep World (${remainingOffloadable.length})</span>`;
      }
      if (footer) {
        footer.innerHTML = `<span>Active in sidebar: <i>${game.scenes.map(s => s.name).join(", ")}</i></span>`;
      }
      // Re-apply search filter if active
      if (searchInput && searchInput.value.trim()) {
        filterScenes(searchInput.value.toLowerCase().trim());
      }
    }

    function filterScenes(query) {
      root.querySelectorAll(".module-group").forEach(group => {
        const modName = group.dataset.moduleName || "";
        let visibleCount = 0;

        group.querySelectorAll(".scene-item").forEach(row => {
          const title = row.querySelector(".scene-name").textContent.toLowerCase();
          const matches = !query || title.includes(query) || modName.includes(query);
          row.style.setProperty("display", matches ? "flex" : "none", "important");
          if (matches) visibleCount++;
        });

        group.style.display = visibleCount > 0 ? "" : "none";

        const list = group.querySelector(".module-scenes-list");
        const icon = group.querySelector(".folder-toggle-icon");

        if (query) {
          list.style.display = "";
          icon.textContent = "▼";
        } else {
          const modKey = group.querySelector(".module-header")?.dataset.module;
          const shouldExpand = allExpanded || expandedModules.has(modKey);
          list.style.display = shouldExpand ? "" : "none";
          icon.textContent = shouldExpand ? "▼" : "▶";
        }
      });
    }

    // Toggle all expand/collapse
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        allExpanded = !allExpanded;
        root.querySelectorAll(".module-group").forEach(group => {
          const list = group.querySelector(".module-scenes-list");
          const icon = group.querySelector(".folder-toggle-icon");
          const mod = group.querySelector(".module-header")?.dataset.module;
          list.style.display = allExpanded ? "" : "none";
          icon.textContent = allExpanded ? "▼" : "▶";
          if (allExpanded && mod) expandedModules.add(mod);
          else if (!allExpanded && mod) expandedModules.delete(mod);
        });
        toggleAllBtn.querySelector("span").textContent = allExpanded ? "Collapse All" : "Expand All";
        toggleAllBtn.querySelector("i").className = allExpanded ? "fas fa-compress-alt" : "fas fa-expand-alt";
      });
    }

    // Sweep World button
    if (cleanWorldBtn) {
      cleanWorldBtn.addEventListener("click", async () => {
        cleanWorldBtn.disabled = true;
        cleanWorldBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sweeping...`;
        await sweepWorld();
        refreshView();
        cleanWorldBtn.disabled = false;
      });
    }

    // Delegated click on container
    container.addEventListener("click", async (e) => {
      // 1. Batch Load Module
      const loadModBtn = e.target.closest(".btn-load-module");
      if (loadModBtn) {
        e.stopPropagation();
        const modName = loadModBtn.dataset.module;
        const grouped = getGroupedScenes();
        const scenes = grouped[modName] || [];
        loadModBtn.disabled = true;
        loadModBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;
        expandedModules.add(modName);
        await loadModuleScenes(modName, scenes);
        refreshView();
        return;
      }

      // 2. Batch Offload Module
      const offloadModBtn = e.target.closest(".btn-offload-module");
      if (offloadModBtn) {
        e.stopPropagation();
        const modName = offloadModBtn.dataset.module;
        const grouped = getGroupedScenes();
        const scenes = grouped[modName] || [];
        offloadModBtn.disabled = true;
        offloadModBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Offloading...`;
        await offloadModuleScenes(modName, scenes);
        refreshView();
        return;
      }

      // 3. Single Scene Offload
      const offloadBtn = e.target.closest(".btn-offload-scene");
      if (offloadBtn) {
        e.stopPropagation();
        const sceneId = offloadBtn.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (scene) {
          offloadBtn.disabled = true;
          offloadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
          const mod = offloadBtn.dataset.module;
          if (mod) expandedModules.add(mod);
          await offloadSceneDoc(scene);
          refreshView();
        }
        return;
      }

      // 4. Toggle single module header accordion
      const header = e.target.closest(".module-header");
      if (header) {
        const modName = header.dataset.module;
        const group = header.closest(".module-group");
        const list = group.querySelector(".module-scenes-list");
        const icon = header.querySelector(".folder-toggle-icon");
        const isCollapsed = list.style.display === "none";
        list.style.display = isCollapsed ? "" : "none";
        icon.textContent = isCollapsed ? "▼" : "▶";
        if (isCollapsed) expandedModules.add(modName);
        else expandedModules.delete(modName);
        return;
      }

      // 5. Single Scene Activate / Switch To
      const activateBtn = e.target.closest(".btn-activate-scene");
      if (activateBtn) {
        e.stopPropagation();
        const sceneId = activateBtn.dataset.sceneId;
        const moduleName = activateBtn.dataset.module;
        activateBtn.disabled = true;
        activateBtn.textContent = "...";
        await activateScene(sceneId, moduleName);
        dialog.close();
      }
    });

    // Double-click row to activate
    container.addEventListener("dblclick", async (e) => {
      const row = e.target.closest(".scene-item");
      if (row) {
        const sceneId = row.dataset.sceneId;
        const moduleName = row.dataset.module;
        await activateScene(sceneId, moduleName);
        dialog.close();
      }
    });

    // Keyboard navigation (Enter / Space on focused row)
    container.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const row = e.target.closest(".scene-item");
        if (row) {
          e.preventDefault();
          const sceneId = row.dataset.sceneId;
          const moduleName = row.dataset.module;
          await activateScene(sceneId, moduleName);
          dialog.close();
        }
      }
    });

    // Live search with auto-expand and Enter key support
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        filterScenes(e.target.value.toLowerCase().trim());
      });

      // Press Enter in search input to activate top visible scene
      searchInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const firstVisible = Array.from(container.querySelectorAll(".scene-item")).find(el => el.offsetParent !== null);
          if (firstVisible) {
            const sceneId = firstVisible.dataset.sceneId;
            const moduleName = firstVisible.dataset.module;
            await activateScene(sceneId, moduleName);
            dialog.close();
          }
        }
      });
    }
  });

  dialog.render({ force: true });
})();
