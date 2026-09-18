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

describe("Quick Scene Swapper Macro", () => {
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

        const importedScene = {
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
            createThumbnail: jest.fn().mockResolvedValue({ thumb: 'data:image/webp;base64,mockthumb' })
        };

        mockScenes = [
            { _id: 'hub1234567890123', id: 'hub1234567890123', name: 'Ingot Inn - Threshold', active: true, folder: null }
        ];

        mockFolders = [
            { id: 'parentSites12345', name: 'Justin Sites', type: 'Scene', folder: null }
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
            }]
        ]);

        mockPack = {
            collection: 'world.gygax75-scenes',
            locked: true,
            folders: compFolders,
            getIndex: jest.fn().mockResolvedValue(compIndex),
            getDocument: jest.fn()
        };

        global.game = {
            packs: {
                get: jest.fn((key) => key === 'world.gygax75-scenes' ? mockPack : null)
            },
            scenes: Object.assign([...mockScenes], {
                get: jest.fn((id) => mockScenes.find(s => s._id === id || s.id === id)),
                getName: jest.fn((name) => mockScenes.find(s => s.name === name)),
                importFromCompendium: jest.fn().mockImplementation(async (pack, id, { folder }, { keepId }) => {
                    importedScene.folder = { id: folder };
                    mockScenes.push(importedScene);
                    return importedScene;
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
                const newFolder = { id: 'newFolderId12345', ...data };
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
        expect(dlg.config.position).toEqual({ width: 660, height: 560 });
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
        expect(content).toContain("Active in sidebar: <i>Ingot Inn - Threshold</i>");
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
            { folder: 'newFolderId12345' },
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

    test("activates existing world scene directly without re-importing", async () => {
        // Pre-load B2 into world
        const existingB2 = {
            _id: 'DftBS0oXPmkEinpe',
            id: 'DftBS0oXPmkEinpe',
            name: 'B2 Caves of Chaos',
            active: false,
            thumb: 'worlds/old-school-essentials/assets/scenes/DftBS0oXPmkEinpe-thumb.webp',
            folder: { id: 'fldB2World123456' },
            activate: jest.fn().mockResolvedValue(true),
            update: jest.fn().mockResolvedValue(true),
            createThumbnail: jest.fn()
        };
        mockScenes.push(existingB2);
        mockFolders.push({ id: 'fldB2World123456', name: 'B2 Keep on the Borderlands', type: 'Scene', folder: 'parentSites12345' });

        eval(macroScript);
        await new Promise(r => setTimeout(r, 50));

        const dlg = MockDialogV2.instances[0];
        const activateBtn = dlg.element.querySelector('.btn-activate-scene[data-scene-id="DftBS0oXPmkEinpe"]');
        expect(activateBtn).not.toBeNull();
        expect(activateBtn.textContent.trim()).toBe("Switch To");

        activateBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        expect(global.game.scenes.importFromCompendium).not.toHaveBeenCalled();
        expect(existingB2.activate).toHaveBeenCalled();
        expect(existingB2.createThumbnail).not.toHaveBeenCalled(); // Thumb is already valid
        expect(dlg.close).toHaveBeenCalled();
    });
});
