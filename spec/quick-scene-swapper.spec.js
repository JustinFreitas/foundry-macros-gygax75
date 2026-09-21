const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/quick-scene-swapper.js'), 'utf8');

class MockDialogV2 {
    static instances = [];

    constructor(config) {
        this.config = config;
        this.element = document.createElement('div');
        this.element.innerHTML = typeof config.content === 'string' ? config.content : '';
        this.render = jest.fn();
        this.close = jest.fn();
        this.addEventListener = jest.fn((event, cb) => {
            if (event === 'render') {
                cb();
            }
        });
        MockDialogV2.instances.push(this);
    }
}

describe("Quick Scene Swapper Macro (Unified V2)", () => {
    let mockPack;
    let mockScenes;
    let mockFolders;
    let mockHooks;

    beforeEach(() => {
        MockDialogV2.instances = [];

        global.foundry = {
            applications: {
                api: {
                    DialogV2: MockDialogV2
                }
            },
            utils: {
                mergeObject: (target, source) => Object.assign({}, target, source)
            }
        };

        mockHooks = {
            once: jest.fn((event, cb) => {
                if (event === 'canvasReady') cb();
            })
        };
        global.Hooks = mockHooks;

        const importedStonefast = {
            _id: 'sc01234567890123',
            id: 'sc01234567890123',
            name: 'Stonefast: Level 1',
            active: false,
            thumb: 'worlds/ose/assets/scenes/sc01234567890123-thumb.webp', // Legacy path needing self-heal
            folder: null,
            activate: jest.fn().mockImplementation(async function() {
                this.active = true;
                global.canvas.scene = this;
            }),
            update: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockScenes.indexOf(this);
                if (idx !== -1) mockScenes.splice(idx, 1);
            }),
            createThumbnail: jest.fn().mockResolvedValue({ thumb: 'data:image/webp;base64,mockthumb' })
        };

        const importedB2Caves = {
            _id: 'DftBS0oXPmkEinpe',
            id: 'DftBS0oXPmkEinpe',
            name: 'B2 Caves of Chaos',
            active: false,
            thumb: 'worlds/old-school-essentials/assets/scenes/DftBS0oXPmkEinpe-thumb.webp',
            folder: null,
            activate: jest.fn().mockImplementation(async function() {
                this.active = true;
                global.canvas.scene = this;
            }),
            update: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockScenes.indexOf(this);
                if (idx !== -1) mockScenes.splice(idx, 1);
            }),
            createThumbnail: jest.fn().mockResolvedValue({ thumb: 'mockthumb' })
        };

        const importedB2Keep = {
            _id: 'b2Keep1234567890',
            id: 'b2Keep1234567890',
            name: 'B2 The Keep',
            active: false,
            thumb: 'worlds/old-school-essentials/assets/scenes/b2Keep-thumb.webp',
            folder: null,
            activate: jest.fn().mockImplementation(async function() {
                this.active = true;
                global.canvas.scene = this;
            }),
            update: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockScenes.indexOf(this);
                if (idx !== -1) mockScenes.splice(idx, 1);
            }),
            createThumbnail: jest.fn().mockResolvedValue({ thumb: 'mockthumb' })
        };

        mockScenes = [
            {
                _id: 'hub1234567890123',
                id: 'hub1234567890123',
                name: 'Ingot Inn - Threshold',
                active: true,
                folder: null,
                activate: jest.fn().mockResolvedValue(true)
            },
            {
                _id: 'hub2234567890123',
                id: 'hub2234567890123',
                name: 'Gemthrone Valley',
                active: false,
                folder: null,
                activate: jest.fn().mockResolvedValue(true)
            },
            {
                _id: 'hub4234567890123',
                id: 'hub4234567890123',
                name: 'Combat',
                active: false,
                folder: null,
                activate: jest.fn().mockResolvedValue(true)
            },
            {
                _id: 'hub5234567890123',
                id: 'hub5234567890123',
                name: 'TotM Combat w/ OSE Rules',
                active: false,
                folder: null,
                activate: jest.fn().mockResolvedValue(true)
            }
        ];

        mockFolders = [
            {
                id: 'parentSites12345',
                name: 'Justin Sites',
                type: 'Scene',
                folder: null,
                delete: jest.fn().mockImplementation(async function() {
                    const idx = mockFolders.indexOf(this);
                    if (idx !== -1) mockFolders.splice(idx, 1);
                })
            }
        ];

        const compFolders = [
            { id: 'cfldStonefast01', name: 'Stonefast', color: '#3498db' },
            { id: 'cfldB2Borderlands', name: 'B2 Keep on the Borderlands', color: '#8f2367' }
        ];

        const compIndex = new Map([
            ['sc01234567890123', {
                _id: 'sc01234567890123',
                name: 'Stonefast: Level 1',
                folder: 'cfldStonefast01',
                flags: { gygax75: { module: 'Stonefast' } }
            }],
            ['DftBS0oXPmkEinpe', {
                _id: 'DftBS0oXPmkEinpe',
                name: 'B2 Caves of Chaos',
                folder: 'cfldB2Borderlands',
                flags: { gygax75: { module: 'B2 Keep on the Borderlands' } }
            }],
            ['b2Keep1234567890', {
                _id: 'b2Keep1234567890',
                name: 'B2 The Keep',
                folder: 'cfldB2Borderlands',
                flags: { gygax75: { module: 'B2 Keep on the Borderlands' } }
            }]
        ]);

        mockPack = {
            collection: 'world.gygax75-scenes',
            locked: true,
            folders: compFolders,
            getIndex: jest.fn().mockResolvedValue(compIndex),
            configure: jest.fn().mockImplementation(async ({ locked }) => {
                mockPack.locked = locked;
            }),
            getDocument: jest.fn().mockImplementation(async (id) => {
                return {
                    _id: id,
                    delete: jest.fn().mockResolvedValue(true)
                };
            }),
            importDocument: jest.fn().mockResolvedValue(true)
        };

        const sceneDict = {
            'sc01234567890123': importedStonefast,
            'DftBS0oXPmkEinpe': importedB2Caves,
            'b2Keep1234567890': importedB2Keep
        };

        global.game = {
            packs: {
                get: jest.fn((key) => key === 'world.gygax75-scenes' ? mockPack : null)
            },
            scenes: Object.assign([...mockScenes], {
                get: jest.fn((id) => mockScenes.find(s => s._id === id || s.id === id)),
                getName: jest.fn((name) => mockScenes.find(s => s.name === name)),
                importFromCompendium: jest.fn().mockImplementation(async (pack, id, { folder }, { keepId }) => {
                    const sceneToImport = sceneDict[id];
                    sceneToImport.folder = { id: folder, name: mockFolders.find(f => f.id === folder)?.name };
                    mockScenes.push(sceneToImport);
                    return sceneToImport;
                }),
                filter: (fn) => mockScenes.filter(fn),
                find: (fn) => mockScenes.find(fn),
                map: (fn) => mockScenes.map(fn)
            }),
            folders: Object.assign([...mockFolders], {
                filter: (fn) => mockFolders.filter(fn),
                find: (fn) => mockFolders.find(fn)
            })
        };

        global.canvas = {
            scene: mockScenes[0],
            ready: true
        };

        global.Folder = {
            create: jest.fn().mockImplementation(async (data) => {
                const newFolder = {
                    id: 'newFolderId_' + (data.name || 'fld'),
                    ...data,
                    delete: jest.fn().mockImplementation(async function() {
                        const idx = mockFolders.indexOf(this);
                        if (idx !== -1) mockFolders.splice(idx, 1);
                    })
                };
                mockFolders.push(newFolder);
                return newFolder;
            })
        };

        global.ui = {
            notifications: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };
    });

    test("renders DialogV2 with proper OSE classes, position, and title", async () => {
        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        expect(MockDialogV2.instances.length).toBe(1);
        const dlg = MockDialogV2.instances[0];

        expect(dlg.config.classes).toEqual(["ose", "dialog"]);
        expect(dlg.config.position).toEqual({ width: 680, height: 580 });
        expect(dlg.config.window.title).toBe("Quick Scene Swapper");
        expect(dlg.render).toHaveBeenCalledWith({ force: true });
    });

    test("groups scenes by module and displays active sidebar list in footer", async () => {
        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        const content = dlg.config.content;

        expect(content).toContain("B2 Keep on the Borderlands");
        expect(content).toContain("B2 Caves of Chaos");
        expect(content).toContain("Stonefast");
        expect(content).toContain("Stonefast: Level 1");
        expect(content).toContain("Active in sidebar: <i>Ingot Inn - Threshold");
    });

    test("activates compendium scene, creates world folder nested under 'Justin Sites' with compendium color, and self-heals thumbnail", async () => {
        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        const activateBtn = dlg.element.querySelector('.btn-activate-scene[data-scene-id="sc01234567890123"]');
        expect(activateBtn).not.toBeNull();

        activateBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        // 1. Folder created with parent 'Justin Sites' and compendium folder color '#3498db'
        expect(global.Folder.create).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Stonefast',
                type: 'Scene',
                folder: 'parentSites12345',
                color: '#3498db'
            })
        );

        // 2. Scene imported from compendium keeping exact 16-char ID
        expect(global.game.scenes.importFromCompendium).toHaveBeenCalledWith(
            mockPack,
            'sc01234567890123',
            expect.objectContaining({ folder: expect.stringContaining('Stonefast') }),
            { keepId: true }
        );

        // 3. Self-healing regenerated thumbnail because thumb had legacy 'worlds/ose/'
        const imported = global.game.scenes.get('sc01234567890123');
        expect(imported.createThumbnail).toHaveBeenCalled();
        expect(imported.update).toHaveBeenCalledWith(
            { thumb: 'data:image/webp;base64,mockthumb' },
            { diff: false }
        );

        // 4. Notification shown and dialog closed
        expect(global.ui.notifications.info).toHaveBeenCalledWith(
            expect.stringContaining("Activated [Stonefast] Stonefast: Level 1")
        );
        expect(dlg.close).toHaveBeenCalled();
    });

    test("batch loads all scenes for a module ('Swap Everything in Module')", async () => {
        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        const loadModBtn = dlg.element.querySelector('.btn-load-module[data-module="B2 Keep on the Borderlands"]');
        expect(loadModBtn).not.toBeNull();
        expect(loadModBtn.textContent).toContain("Load All (2)");

        loadModBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        // Both B2 Caves and B2 Keep imported
        expect(global.game.scenes.importFromCompendium).toHaveBeenCalledWith(
            mockPack,
            'DftBS0oXPmkEinpe',
            expect.anything(),
            { keepId: true }
        );
        expect(global.game.scenes.importFromCompendium).toHaveBeenCalledWith(
            mockPack,
            'b2Keep1234567890',
            expect.anything(),
            { keepId: true }
        );
        expect(global.ui.notifications.info).toHaveBeenCalledWith(
            expect.stringContaining("Imported 2 scenes for [B2 Keep on the Borderlands]")
        );

        // Dialog stayed open and re-rendered view with Offload All button
        const offloadModBtn = dlg.element.querySelector('.btn-offload-module[data-module="B2 Keep on the Borderlands"]');
        expect(offloadModBtn).not.toBeNull();
        expect(offloadModBtn.textContent).toContain("Offload All (2)");
    });

    test("batch offloads all scenes for a module and cleans up empty world folder", async () => {
        // Pre-load B2 scenes into world
        const b2Folder = {
            id: 'fldB2Borderlands',
            name: 'B2 Keep on the Borderlands',
            type: 'Scene',
            folder: 'parentSites12345',
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockFolders.indexOf(this);
                if (idx !== -1) mockFolders.splice(idx, 1);
            })
        };
        mockFolders.push(b2Folder);

        const b2Caves = {
            _id: 'DftBS0oXPmkEinpe',
            id: 'DftBS0oXPmkEinpe',
            name: 'B2 Caves of Chaos',
            active: false,
            folder: b2Folder,
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockScenes.indexOf(this);
                if (idx !== -1) mockScenes.splice(idx, 1);
            })
        };
        const b2Keep = {
            _id: 'b2Keep1234567890',
            id: 'b2Keep1234567890',
            name: 'B2 The Keep',
            active: false,
            folder: b2Folder,
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockScenes.indexOf(this);
                if (idx !== -1) mockScenes.splice(idx, 1);
            })
        };
        mockScenes.push(b2Caves, b2Keep);

        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        const offloadModBtn = dlg.element.querySelector('.btn-offload-module[data-module="B2 Keep on the Borderlands"]');
        expect(offloadModBtn).not.toBeNull();

        offloadModBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        expect(b2Caves.delete).toHaveBeenCalled();
        expect(b2Keep.delete).toHaveBeenCalled();
        expect(b2Folder.delete).toHaveBeenCalled(); // Empty folder cleaned up
        expect(global.ui.notifications.info).toHaveBeenCalledWith(
            expect.stringContaining("Offloaded 2 scenes from [B2 Keep on the Borderlands]")
        );
    });

    test("sweeps all non-permanent scenes from world when Sweep World is clicked", async () => {
        // Add a temporary scene to the world
        const tempScene = {
            _id: 'sc01234567890123',
            id: 'sc01234567890123',
            name: 'Stonefast: Level 1',
            active: false,
            folder: null,
            delete: jest.fn().mockImplementation(async function() {
                const idx = mockScenes.indexOf(this);
                if (idx !== -1) mockScenes.splice(idx, 1);
            })
        };
        mockScenes.push(tempScene);

        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        const cleanWorldBtn = dlg.element.querySelector('#btnCleanWorld');
        expect(cleanWorldBtn).not.toBeNull();
        expect(cleanWorldBtn.textContent).toContain("Sweep World (1)");

        cleanWorldBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        expect(tempScene.delete).toHaveBeenCalled();
        expect(global.ui.notifications.info).toHaveBeenCalledWith(
            expect.stringContaining("Swept world: successfully offloaded 1 scenes to compendium")
        );
    });

    test("protects permanent campaign hubs from offloading", async () => {
        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        // Ensure hub scenes don't have offload buttons
        const hubOffloadBtn = dlg.element.querySelector('.btn-offload-scene[data-scene-id="hub1234567890123"]');
        expect(hubOffloadBtn).toBeNull();
    });
});
