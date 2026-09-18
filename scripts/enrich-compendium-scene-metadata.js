// Macro: Enrich Compendium Scene Metadata & Build Folders
// Updates world.gygax75-scenes compendium: creates module folders, assigns scenes,
// disambiguates generic scene names, and attaches permanent flags.gygax75.module metadata.
(async () => {
  const pack = game.packs.get("world.gygax75-scenes");
  if (!pack) return ui.notifications.error("Compendium pack 'world.gygax75-scenes' not found!");

  const SCENE_FOLDER_MAP = {
    "4WpgOYQbLquS8g7p": { folder: "Ashburn Manor", name: "Ashburn Manor" },
    "KpWGG3zGVgR6wBgS": { folder: "B1 In Search of the Unknown", name: "Caverns of Quasqueton - Lower" },
    "sUAQwH2VFsgRPkp7": { folder: "B1 In Search of the Unknown", name: "Caverns of Quasqueton - Upper" },
    "QcfViz8OHRfl4CMY": { folder: "B1 In Search of the Unknown", name: "Original - Caverns of Quasqueton - Lower" },
    "NzVPCxwFKkha3Dc9": { folder: "B1 In Search of the Unknown", name: "Original - Caverns of Quasqueton - Upper" },
    "DftBS0oXPmkEinpe": { folder: "B2 Keep on the Borderlands", name: "B2 Caves of Chaos" },
    "JhKgOGlqlrAzg0vV": { folder: "B3 Palace of the Silver Princess", name: "Palace of the Silver Princess - Level 1" },
    "J8pAWw9DnOuR9Lb3": { folder: "B3 Palace of the Silver Princess", name: "Palace of the Silver Princess - Level 2" },
    "wUL2KaSXPoUoIB1c": { folder: "Beneath Goblins Hill", name: "Beneath Goblins Hill" },
    "3cqKPNRH7ItZZQ0q": { folder: "Beneath Goblins Hill", name: "Goblins Hill" },
    "CO22DNcoxgzyzska": { folder: "Bralizzar", name: "Inn of the Golden Palm" },
    "vcyUZGwsC7pvxJBR": { folder: "Bralizzar", name: "The Swayback Camel" },
    "RU7LFOjBPaahMdP8": { folder: "Chris Sites", name: "Shrine of Sootmurk" },
    "hrDqm44IpoXJUkbM": { folder: "Chris Sites", name: "Torthen's Tomb" },
    "r6sTIHPnGvXysS0h": { folder: "Forgotten Crypt of Queen Gilaren", name: "Forgotten Crypt of Queen Gilaren" },
    "WHQYPf8aOfFZuCbq": { folder: "Home of Aman Al-Raqib", name: "Home of Aman Al-Raqib - 1st Floor" },
    "u5AyOOvS1VY3i6M9": { folder: "Home of Aman Al-Raqib", name: "Home of Aman Al-Raqib - 2nd Floor" },
    "Bjk8qjBTQe02MN9g": { folder: "I3-5 Desert of Desolation", name: "Desert of Desolation - Hex" },
    "uo8mAnOaqPCEdr9e": { folder: "I3-5 Desert of Desolation", name: "Map 3-1 Troll Cave" },
    "ZRXePoXZG0T4DXH4": { folder: "I3-5 Desert of Desolation", name: "Map 4-1 Town of Bralizzar" },
    "V0NT0mUaJAdPEsD7": { folder: "I3-5 Desert of Desolation", name: "Map 5-1 Northknife Pass" },
    "QHlxFYmr6dNWzF69": { folder: "I3-5 Desert of Desolation", name: "Map 7-1 Sunken City of Pazar" },
    "6CCBi4UEfQmmLEjk": { folder: "I3-5 Desert of Desolation", name: "Narrow Mountain Pass" },
    "NZE2B1srx0fcPW8z": { folder: "Stonefast", name: "Stonefast: Level 1" },
    "BJ43eixBcTZ4gZ1h": { folder: "Temple Ruin", name: "Temple Ruin: Level 1" },
    "gLaJNy8PfNRIBWDq": { folder: "Temple Ruin", name: "Temple Ruin: Level 2" },
    "tPpuErSlWvALIiTL": { folder: "The Halls of Lost Heroes", name: "The Halls of Lost Heroes" },
    "aC1fl4CdHtkroydh": { folder: "Veiled Dungeon of the Jade God", name: "Veiled Dungeon of the Jade God" },
    "dL47V2y7R0dQvD02": { folder: "X1 Isle of Dread", name: "Taboo Island Temple" },
    "qf380hpKGKL55bDe": { folder: "X1 Isle of Dread", name: "Taboo Island Temple Level 2" }
  };

  const FOLDER_COLOR_MAP = {
    "B2 Keep on the Borderlands": "#8f2367",
    "B3 Palace of the Silver Princess": "#1e780d"
  };

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  // 1. Ensure compendium folders exist
  const compFolders = {};
  for (const f of pack.folders) {
    compFolders[f.name] = f;
  }

  const distinctFolders = [...new Set(Object.values(SCENE_FOLDER_MAP).map(v => v.folder))];
  for (const folderName of distinctFolders) {
    if (!compFolders[folderName]) {
      const newFolder = await Folder.create(
        { name: folderName, type: "Scene", folder: null, color: FOLDER_COLOR_MAP[folderName] || null },
        { pack: pack.collection }
      );
      compFolders[folderName] = newFolder;
    } else if (!compFolders[folderName].color && FOLDER_COLOR_MAP[folderName]) {
      await compFolders[folderName].update({ color: FOLDER_COLOR_MAP[folderName] });
    }
  }

  // 2. Update scenes in compendium with names, folders, and flags
  let updatedCount = 0;
  for (const [sceneId, meta] of Object.entries(SCENE_FOLDER_MAP)) {
    const sceneDoc = await pack.getDocument(sceneId);
    if (!sceneDoc) continue;

    const folderDoc = compFolders[meta.folder];
    await sceneDoc.update({
      name: meta.name,
      folder: folderDoc ? folderDoc.id : null,
      "flags.gygax75": { module: meta.folder }
    });
    updatedCount++;
  }

  if (wasLocked) await pack.configure({ locked: true });
  ui.notifications.info(`Updated ${updatedCount} scenes in Gygax75-Scenes with folders & module metadata!`);
})();
