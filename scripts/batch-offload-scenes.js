// Macro: Batch Offload Inactive Scenes to gygax75-scenes Compendium
// Verified against Foundry V14 Core Engine
(async () => {
  const pack = game.packs.get("world.gygax75-scenes");
  if (!pack) return ui.notifications.error("Compendium pack 'world.gygax75-scenes' not found!");

  const RETAIN_SCENES = [
    "Ingot Inn - Threshold",
    "Gemthrone Valley",
    "Combat",
    "TotM Combat w/ OSE Rules"
  ];

  const scenesToOffload = game.scenes.filter(s => !RETAIN_SCENES.includes(s.name));
  if (scenesToOffload.length === 0) {
    ui.notifications.info("All inactive scenes are already offloaded! Only the 4 active scenes remain.");
    return;
  }

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  let count = 0;
  for (const scene of scenesToOffload) {
    const moduleName = scene.folder?.name || "General / Other";

    // Ensure compendium folder exists
    let compFolder = pack.folders.find(f => f.name === moduleName);
    if (!compFolder && scene.folder) {
      compFolder = await Folder.create(
        { name: moduleName, type: "Scene", folder: null, color: scene.folder?.color || null },
        { pack: pack.collection }
      );
    }

    // Sanitize broken legacy thumbnails on export
    const isBrokenThumb = !scene.thumb || scene.thumb.includes("worlds/ose/") || scene.thumb.includes("forge-migration/");

    // Prepare updateData with compendium folder ID and metadata flag
    const updateData = {
      folder: compFolder ? compFolder.id : null,
      "flags.gygax75.module": moduleName,
      ...(isBrokenThumb ? { thumb: null } : {})
    };

    // Export scene to compendium preserving exact 16-char ID and mapping metadata
    await pack.importDocument(scene, {
      keepId: true,
      transform: (data) => foundry.utils.mergeObject(data, updateData)
    });

    // Safely delete from active world sidebar
    await scene.delete();
    count++;
    console.log(`[Scene Offloader] [${count}/${scenesToOffload.length}] Offloaded: ${scene.name} -> [${moduleName}]`);
  }

  if (wasLocked) await pack.configure({ locked: true });
  ui.notifications.info(`Successfully offloaded ${count} scenes to Gygax75-Scenes compendium with folders & metadata!`);
})();
