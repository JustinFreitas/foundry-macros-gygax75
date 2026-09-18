const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/quick-scene-offloader.js'), 'utf8');

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

describe("Quick Scene Offloader Macro", () => {
    let mockPack;
    let mockScenes;
    let mockFolders;

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

        mockScenes = [
            { _id: 'hub1234567890123', id: 'hub1234567890123', name: 'Ingot Inn - Threshold', active: true, folder: null },
            { _id: 'hub2234567890123', id: 'hub2234567890123', name: 'Gemthrone Valley', active: false, folder: null },
            { _id: 'hub4234567890123', id: 'hub4234567890123', name: 'Combat', active: false, folder: null },
            { _id: 'hub5234567890123', id: 'hub5234567890123', name: 'TotM Combat w/ OSE Rules', active: false, folder: null },
            {
                _id: 'sc01234567890123',
                id: 'sc01234567890123',
                name: 'Stonefast: Level 1',
                active: false,
                folder: { id: 'fld1234567890123', name: 'Stonefast', color: '#123456', delete: jest.fn().mockResolvedValue(true) },
                delete: jest.fn().mockResolvedValue(true),
                flags: { gygax75: { module: 'Stonefast' } }
            }
        ];

        mockFolders = [
            { id: 'fld1234567890123', name: 'Stonefast', type: 'Scene', folder: null, color: '#123456', delete: jest.fn().mockResolvedValue(true) }
        ];

        mockPack = {
            collection: 'world.gygax75-scenes',
            locked: true,
            folders: [{ id: 'cfld123456789012', name: 'Stonefast' }],
            configure: jest.fn().mockImplementation(async ({ locked }) => {
                mockPack.locked = locked;
            }),
            getDocument: jest.fn().mockResolvedValue({
                _id: 'sc01234567890123',
                delete: jest.fn().mockResolvedValue(true)
            }),
            importDocument: jest.fn().mockResolvedValue(true)
        };

        global.game = {
            packs: {
                get: jest.fn((key) => key === 'world.gygax75-scenes' ? mockPack : null)
            },
            scenes: Object.assign([...mockScenes], {
                get: jest.fn((id) => mockScenes.find(s => s._id === id || s.id === id)),
                getName: jest.fn((name) => mockScenes.find(s => s.name === name)),
                filter: (fn) => mockScenes.filter(fn),
                find: (fn) => mockScenes.find(fn)
            }),
            folders: Object.assign([...mockFolders], {
                filter: (fn) => mockFolders.filter(fn),
                find: (fn) => mockFolders.find(fn)
            })
        };

        global.canvas = {
            scene: mockScenes[4] // Viewing Stonefast: Level 1
        };

        global.Folder = {
            create: jest.fn().mockResolvedValue({ id: 'newfld123456789', name: 'New Folder' })
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

        expect(MockDialogV2.instances.length).toBe(1);
        const dlg = MockDialogV2.instances[0];

        expect(dlg.config.classes).toEqual(["ose", "dialog"]);
        expect(dlg.config.position).toEqual({ width: 560, height: 460 });
        expect(dlg.config.window.title).toBe("Swap Scene Out to Compendium");
        expect(dlg.render).toHaveBeenCalledWith({ force: true });
    });

    test("displays currently viewed offloadable scene and loaded scene count", async () => {
        eval(macroScript);

        const dlg = MockDialogV2.instances[0];
        const content = dlg.config.content;

        expect(content).toContain("Currently Viewed Scene");
        expect(content).toContain("Stonefast: Level 1");
        expect(content).toContain("Loaded Temporary Scenes (1)");
        expect(content).toContain("Offload Current");
    });

    test("renders 'World is Clean!' message when only permanent hubs are loaded", async () => {
        mockScenes.pop(); // Remove Stonefast
        global.canvas.scene = mockScenes[0]; // Ingot Inn

        eval(macroScript);

        const dlg = MockDialogV2.instances[0];
        const content = dlg.config.content;

        expect(content).toContain("World is Clean!");
        expect(content).toContain("Permanent Campaign Hub");
        expect(content).not.toContain("Offload Current");
    });

    test("offloading a scene deletes existing compendium copy, imports new copy, and deletes world scene", async () => {
        eval(macroScript);

        const dlg = MockDialogV2.instances[0];
        const offloadBtn = dlg.element.querySelector('.btn-offload-single[data-scene-id="sc01234567890123"]');
        expect(offloadBtn).not.toBeNull();

        // Simulate click
        offloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // Wait for async execution
        await new Promise(r => setTimeout(r, 100));

        expect(mockPack.configure).toHaveBeenCalledWith({ locked: false });
        expect(mockPack.getDocument).toHaveBeenCalledWith('sc01234567890123');
        expect(mockPack.importDocument).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Stonefast: Level 1' }),
            expect.objectContaining({ keepId: true })
        );
        expect(mockScenes[4].delete).toHaveBeenCalled();
        expect(mockPack.configure).toHaveBeenLastCalledWith({ locked: true });
        expect(global.ui.notifications.info).toHaveBeenCalledWith(
            expect.stringContaining('Successfully offloaded "Stonefast: Level 1"')
        );
    });

    test("offloading an active scene switches to fallback hub first", async () => {
        const stonefast = mockScenes[4];
        stonefast.active = true;

        const fallback = mockScenes[0]; // Ingot Inn
        fallback.activate = jest.fn().mockImplementation(async () => {
            stonefast.active = false;
            fallback.active = true;
        });

        eval(macroScript);

        const dlg = MockDialogV2.instances[0];
        const offloadBtn = dlg.element.querySelector('.btn-offload-single[data-scene-id="sc01234567890123"]');

        offloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 350));

        expect(fallback.activate).toHaveBeenCalled();
        expect(stonefast.delete).toHaveBeenCalled();
        expect(global.ui.notifications.info).toHaveBeenCalledWith(
            expect.stringContaining('Switching active scene to "Ingot Inn - Threshold"')
        );
    });

    test("safeguards permanent campaign scenes from offloading", async () => {
        eval(macroScript);

        const dlg = MockDialogV2.instances[0];
        // Ensure Ingot Inn does not appear in the offloadable list
        expect(dlg.element.querySelector('.btn-offload-single[data-scene-id="hub1234567890123"]')).toBeNull();
    });

    test("allows B2 Caves of Chaos to be offloaded and preserves folder color", async () => {
        // Add B2 scene to mockScenes
        const b2Scene = {
            _id: 'DftBS0oXPmkEinpe',
            id: 'DftBS0oXPmkEinpe',
            name: 'B2 Caves of Chaos',
            active: false,
            thumb: 'worlds/ose/assets/scenes/DftBS0oXPmkEinpe-thumb.webp', // Broken legacy path
            folder: { id: 'fldb212345678901', name: 'B2 Keep on the Borderlands', color: '#8f2367', delete: jest.fn().mockResolvedValue(true) },
            delete: jest.fn().mockResolvedValue(true),
            flags: { gygax75: { module: 'B2 Keep on the Borderlands' } }
        };
        mockScenes.push(b2Scene);
        global.canvas.scene = b2Scene;

        eval(macroScript);

        const dlg = MockDialogV2.instances[0];
        const offloadBtn = dlg.element.querySelector('.btn-offload-single[data-scene-id="DftBS0oXPmkEinpe"]');
        expect(offloadBtn).not.toBeNull();

        offloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        // Compendium folder should be created with the scene folder's color #8f2367
        expect(global.Folder.create).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'B2 Keep on the Borderlands',
                type: 'Scene',
                color: '#8f2367'
            }),
            expect.anything()
        );

        // Transform should sanitize broken thumb to null
        expect(mockPack.importDocument).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'B2 Caves of Chaos' }),
            expect.objectContaining({
                keepId: true,
                transform: expect.any(Function)
            })
        );

        const transformFn = mockPack.importDocument.mock.calls[0][1].transform;
        const transformedData = transformFn({ ...b2Scene });
        expect(transformedData.thumb).toBeNull();
        expect(b2Scene.delete).toHaveBeenCalled();
    });
});
