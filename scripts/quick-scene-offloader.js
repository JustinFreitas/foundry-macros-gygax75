// Macro: Swap Scene Out to Compendium (Quick Scene Offloader)
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

  // Atomic offload function for a single scene
  async function offloadScene(scene) {
    if (!scene) return false;

    if (PROTECTED_SCENES.includes(scene.name)) {
      ui.notifications.warn(`"${scene.name}" is a permanent campaign hub and cannot be offloaded.`);
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

        ui.notifications.info(`Switching active scene to "${fallback.name}" before offloading...`);
        await fallback.activate();
        // Allow canvas tear-down and socket broadcast to complete
        await new Promise(resolve => setTimeout(resolve, 250));

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

      // Sanitize broken legacy thumbnails on export
      const isBrokenThumb = !scene.thumb || scene.thumb.includes("worlds/ose/") || scene.thumb.includes("forge-migration/");

      const updateData = {
        folder: compFolder ? compFolder.id : null,
        "flags.gygax75.module": moduleName,
        ...(isBrokenThumb ? { thumb: null } : {})
      };

      // 4. Overwrite/save to compendium with exact 16-character ID preserved
      const existingInPack = await pack.getDocument(scene.id);
      if (existingInPack) {
        await existingInPack.delete();
      }

      await pack.importDocument(scene, {
        keepId: true,
        transform: (data) => foundry.utils.mergeObject(data, updateData)
      });

      // 5. Delete scene from world
      const worldFolder = scene.folder;
      await scene.delete();

      // 6. Clean up empty world folder if no scenes and no subfolders remain
      if (worldFolder) {
        const remainingScenes = game.scenes.filter(s => s.folder?.id === worldFolder.id);
        const subfolders = game.folders.filter(f => f.folder?.id === worldFolder.id);
        if (remainingScenes.length === 0 && subfolders.length === 0) {
          await worldFolder.delete();
          console.log(`[Scene Offloader] Deleted empty world folder: ${worldFolder.name}`);
        }
      }

      ui.notifications.info(`Successfully offloaded "${scene.name}" to Gygax75-Scenes compendium.`);
      return true;
    } catch (err) {
      console.error("Offload Scene Error:", err);
      ui.notifications.error(`Failed to offload scene "${scene.name}": ${err.message}`);
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

  // Get offloadable scenes in the world
  function getOffloadableScenes() {
    return game.scenes.filter(s => !PROTECTED_SCENES.includes(s.name));
  }

  const currentScene = canvas?.scene;
  const isCurrentOffloadable = currentScene && !PROTECTED_SCENES.includes(currentScene.name);

  function buildContent() {
    const offloadable = getOffloadableScenes();

    let currentCardHtml = "";
    if (currentScene) {
      if (isCurrentOffloadable) {
        currentCardHtml = `
          <div style="background: rgba(231, 76, 60, 0.15); border: 1px solid #e74c3c; border-radius: 4px; padding: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div style="min-width: 0; flex: 1; margin-right: 12px;">
              <div style="font-size: 0.78em; text-transform: uppercase; color: #e74c3c; font-weight: bold; letter-spacing: 0.5px;">Currently Viewed Scene</div>
              <div style="font-size: 1.05em; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentScene.name}</div>
              <div style="font-size: 0.8em; color: #a0aec0;">Module: ${currentScene.folder?.name || "None"} ${currentScene.active ? "• <span style='color: #2ecc71; font-weight: bold;'>Active</span>" : ""}</div>
            </div>
            <button type="button" class="btn-offload-single" data-scene-id="${currentScene._id}" style="width: auto !important; height: 32px !important; line-height: 30px !important; padding: 0 14px !important; margin: 0 !important; background: #c0392b; color: #fff; font-weight: bold; border-radius: 3px; cursor: pointer; display: inline-flex !important; align-items: center; gap: 6px; flex-shrink: 0;">
              <i class="fas fa-box-archive"></i> Offload Current
            </button>
          </div>
        `;
      } else {
        currentCardHtml = `
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div>
              <span style="font-size: 0.85em; color: #a0aec0;">Viewing: </span>
              <strong style="color: #e2d6b5;">${currentScene.name}</strong>
            </div>
            <span style="background: #2980b9; color: #fff; font-size: 0.75em; padding: 2px 8px; border-radius: 3px; font-weight: bold;">Permanent Campaign Hub</span>
          </div>
        `;
      }
    }

    let rowsHtml = "";
    if (offloadable.length === 0) {
      rowsHtml = `
        <div style="text-align: center; padding: 36px 12px; color: #a0aec0;">
          <i class="fas fa-check-circle" style="font-size: 2.2em; color: #2ecc71; margin-bottom: 10px; display: block;"></i>
          <strong style="font-size: 1.1em; color: #f0f0f0;">World is Clean!</strong>
          <div style="font-size: 0.88em; margin-top: 6px; line-height: 1.4;">Only the permanent campaign scenes are currently loaded in the sidebar.</div>
        </div>
      `;
    } else {
      for (const sc of offloadable) {
        const mod = sc.flags?.gygax75?.module || sc.folder?.name || "General / Other";
        rowsHtml += `
          <div class="qso-row" data-scene-id="${sc._id}" data-scene-name="${sc.name.toLowerCase()}" data-module-name="${mod.toLowerCase()}" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; height: 34px !important; padding: 0 10px !important; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px !important; box-sizing: border-box !important;">
            <div style="display: flex !important; align-items: center !important; gap: 8px !important; flex: 1 !important; min-width: 0 !important; margin-right: 10px !important;">
              <i class="fas fa-map-marked-alt" style="color: #e2d6b5; font-size: 0.9em; width: 16px; text-align: center; flex-shrink: 0;"></i>
              <span class="qso-scene-title" style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f0f0f0;">${sc.name}</span>
              <span style="font-size: 0.75em; color: #cbd5e0; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 3px; flex-shrink: 0;">${mod}</span>
              ${sc.active ? "<span style='font-size: 0.72em; background: #27ae60; color: #fff; padding: 1px 5px; border-radius: 3px; font-weight: bold; flex-shrink: 0;'>Active</span>" : ""}
            </div>
            <button type="button" class="btn-offload-single" data-scene-id="${sc._id}" style="width: auto !important; height: 24px !important; line-height: 22px !important; padding: 0 10px !important; margin: 0 !important; font-size: 0.8em !important; font-weight: 600 !important; cursor: pointer; border-radius: 3px; display: inline-flex !important; align-items: center !important; gap: 4px; flex-shrink: 0;">
              <i class="fas fa-box-archive"></i> Offload
            </button>
          </div>
        `;
      }
    }

    return `
      <style>
        .qso-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
          gap: 6px;
        }
        .qso-row:hover {
          background: rgba(255,255,255,0.08) !important;
        }
        .btn-offload-single:hover {
          filter: brightness(1.25);
        }
        .qso-search-box {
          width: 100%;
          padding: 6px 10px;
          font-size: 0.9em;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.15);
          box-sizing: border-box;
          margin-bottom: 6px;
        }
      </style>
      <div class="qso-container">
        ${currentCardHtml}

        ${offloadable.length > 3 ? `
          <input type="search" id="qsoSearchInput" class="qso-search-box" placeholder="🔍 Filter loaded scenes..." />
        ` : ""}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; flex-shrink: 0;">
          <span style="font-size: 0.85em; font-weight: bold; color: #e2d6b5;">Loaded Temporary Scenes (${offloadable.length})</span>
          ${offloadable.length > 1 ? `
            <button type="button" id="btnOffloadAll" style="width: auto !important; height: 24px !important; line-height: 22px !important; padding: 0 8px !important; margin: 0 !important; font-size: 0.75em !important; cursor: pointer; display: inline-flex !important; align-items: center; gap: 4px;">
              <i class="fas fa-layer-group"></i> Offload All (${offloadable.length})
            </button>
          ` : ""}
        </div>

        <div id="qsoListContainer" style="flex: 1; overflow-y: auto; min-height: 0; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; background: rgba(0,0,0,0.25);">
          ${rowsHtml}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78em; color: #a0aec0; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 4px; margin-top: 4px; flex-shrink: 0;">
          <span>Permanent Hubs: <i>Ingot Inn, Gemthrone Valley, Combat, TotM Combat</i></span>
        </div>
      </div>
    `;
  }

  const dialog = new foundry.applications.api.DialogV2({
    window: { title: "Swap Scene Out to Compendium", resizable: true },
    classes: ["ose", "dialog"],
    position: { width: 560, height: 460 },
    content: buildContent(),
    buttons: [{
      action: "close",
      label: "Close"
    }]
  });

  dialog.addEventListener("render", () => {
    const root = dialog.element;
    const searchInput = root.querySelector("#qsoSearchInput");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const val = e.target.value.toLowerCase().trim();
        root.querySelectorAll(".qso-row").forEach(row => {
          const sName = row.dataset.sceneName || "";
          const mName = row.dataset.moduleName || "";
          const match = !val || sName.includes(val) || mName.includes(val);
          row.style.setProperty("display", match ? "flex" : "none", "important");
        });
      });
    }

    // Delegated offload clicks
    root.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-offload-single");
      if (btn) {
        e.stopPropagation();
        const sceneId = btn.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (!scene) return;

        btn.disabled = true;
        btn.textContent = "...";
        const ok = await offloadScene(scene);
        if (ok) {
          dialog.close();
        } else {
          btn.disabled = false;
          btn.textContent = "Offload";
        }
      }

      const allBtn = e.target.closest("#btnOffloadAll");
      if (allBtn) {
        allBtn.disabled = true;
        allBtn.textContent = "Offloading...";
        const scenes = getOffloadableScenes();
        for (const s of scenes) {
          await offloadScene(s);
        }
        dialog.close();
      }
    });
  });

  dialog.render({ force: true });
})();
