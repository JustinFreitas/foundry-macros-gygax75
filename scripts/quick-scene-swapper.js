// Macro: Quick Scene Swapper (Compact Visual Scene Browser)
// Verified against Foundry V14 ApplicationV2 / DialogV2
(async () => {
  const pack = game.packs.get("world.gygax75-scenes");
  if (!pack) return ui.notifications.error("Compendium pack 'world.gygax75-scenes' not found!");

  const index = await pack.getIndex({ fields: ["name", "folder", "flags"] });
  if (index.size === 0) return ui.notifications.warn("No scenes found in 'world.gygax75-scenes' compendium.");

  // Build compendium folder name map
  const compFolderMap = {};
  for (const f of pack.folders) {
    compFolderMap[f.id] = f.name;
  }

  // Group scenes by module
  const grouped = {};
  for (const entry of index.values()) {
    const moduleName = (entry.flags?.gygax75?.module) || compFolderMap[entry.folder] || "General / Other";
    if (!grouped[moduleName]) grouped[moduleName] = [];
    grouped[moduleName].push(entry);
  }

  const sortedModules = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  let modulesHtml = "";

  for (const mod of sortedModules) {
    const scenes = grouped[mod].sort((a, b) => a.name.localeCompare(b.name));
    let sceneRowsHtml = "";

    for (const sc of scenes) {
      const inWorld = !!game.scenes.get(sc._id);
      const statusBadge = inWorld 
        ? `<span style="background: #27ae60; color: #fff; font-size: 0.72em; padding: 2px 6px; border-radius: 3px; font-weight: bold; flex-shrink: 0;">Active</span>`
        : `<span style="background: rgba(255,255,255,0.1); color: #cbd5e0; font-size: 0.72em; padding: 2px 6px; border-radius: 3px; flex-shrink: 0;">Compendium</span>`;

      sceneRowsHtml += `
        <div class="scene-item" data-scene-id="${sc._id}" data-module="${mod}" tabindex="0">
          <div class="scene-item-title">
            <i class="fas fa-map-marked-alt scene-icon"></i>
            <span class="scene-name">${sc.name}</span>
          </div>
          <div class="scene-item-actions">
            ${statusBadge}
            <button type="button" class="btn-activate-scene" data-scene-id="${sc._id}" data-module="${mod}">
              ${inWorld ? "Switch To" : "Activate"}
            </button>
          </div>
        </div>
      `;
    }

    modulesHtml += `
      <div class="module-group" data-module-name="${mod.toLowerCase()}">
        <div class="module-header">
          <div class="module-title">
            <span class="folder-toggle-icon">▶</span>
            <span>${mod}</span>
          </div>
          <span class="module-count">${scenes.length}</span>
        </div>
        <div class="module-scenes-list" style="display: none;">
          ${sceneRowsHtml}
        </div>
      </div>
    `;
  }

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
      .qss-btn-toggle-all {
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
        gap: 4px;
        flex-shrink: 0;
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
      }
      .module-count {
        font-size: 0.75em;
        color: #a0aec0;
        background: rgba(0,0,0,0.4);
        padding: 1px 7px;
        border-radius: 10px;
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
      .btn-activate-scene {
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
        transition: filter 0.15s ease;
      }
      .btn-activate-scene:hover {
        filter: brightness(1.25);
      }
    </style>
    <div class="qss-container">
      <div class="qss-toolbar">
        <input type="search" id="sceneSearchInput" class="qss-search" 
               placeholder="🔍 Filter by module or scene name (e.g. Stonefast, B1, Level 1)..." autofocus />
        <button type="button" id="btnToggleAll" class="qss-btn-toggle-all">
          <i class="fas fa-expand-alt"></i> <span>Expand All</span>
        </button>
      </div>

      <div id="scenesContainer">
        ${modulesHtml}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8em; color: #a0aec0; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 4px; flex-shrink: 0;">
        <span>Active in sidebar: <i>${game.scenes.map(s => s.name).join(", ")}</i></span>
      </div>
    </div>
  `;

  // Atomic scene activation with error handling
  async function activateScene(sceneId, moduleName) {
    try {
      let worldFolder = game.folders.find(f => f.type === "Scene" && f.name === moduleName && !f.pack);
      if (!worldFolder) {
        const parent = game.folders.find(f => f.type === "Scene" && f.name === "Justin Sites" && !f.pack);
        const compFolder = pack.folders.find(f => f.name === moduleName);
        worldFolder = await Folder.create({
          name: moduleName,
          type: "Scene",
          folder: parent ? parent.id : null,
          color: compFolder?.color || null
        });
      }

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
    } catch (err) {
      console.error("Quick Scene Swapper error:", err);
      ui.notifications.error(`Failed to activate scene: ${err.message}`);
    }
  }

  const dialog = new foundry.applications.api.DialogV2({
    window: { title: "Quick Scene Swapper", resizable: true },
    classes: ["ose", "dialog"],
    position: { width: 660, height: 560 },
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

    let allExpanded = false;

    // Toggle all expand/collapse
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        allExpanded = !allExpanded;
        root.querySelectorAll(".module-group").forEach(group => {
          const list = group.querySelector(".module-scenes-list");
          const icon = group.querySelector(".folder-toggle-icon");
          list.style.display = allExpanded ? "" : "none";
          icon.textContent = allExpanded ? "▼" : "▶";
        });
        toggleAllBtn.querySelector("span").textContent = allExpanded ? "Collapse All" : "Expand All";
        toggleAllBtn.querySelector("i").className = allExpanded ? "fas fa-compress-alt" : "fas fa-expand-alt";
      });
    }

    // Delegated click on container
    container.addEventListener("click", async (e) => {
      // Toggle single module header
      const header = e.target.closest(".module-header");
      if (header) {
        const group = header.closest(".module-group");
        const list = group.querySelector(".module-scenes-list");
        const icon = header.querySelector(".folder-toggle-icon");
        const isCollapsed = list.style.display === "none";
        list.style.display = isCollapsed ? "" : "none";
        icon.textContent = isCollapsed ? "▼" : "▶";
        return;
      }

      // Activate button
      const btn = e.target.closest(".btn-activate-scene");
      if (btn) {
        e.stopPropagation();
        const sceneId = btn.dataset.sceneId;
        const moduleName = btn.dataset.module;
        btn.disabled = true;
        btn.textContent = "...";
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
        const query = e.target.value.toLowerCase().trim();

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
            // Auto-expand matches when searching
            list.style.display = "";
            icon.textContent = "▼";
          } else {
            // Restore accordion state when search cleared
            list.style.display = allExpanded ? "" : "none";
            icon.textContent = allExpanded ? "▼" : "▶";
          }
        });
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
