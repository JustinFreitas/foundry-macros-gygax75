const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/party-sheet-deploy.js'), 'utf8');

global.canvas = {
    tokens: {
        controlled: []
    },
    grid: {
        size: 100
    },
    scene: {
        createEmbeddedDocuments: jest.fn()
    },
    regions: {
        placeables: []
    }
};

global.CONFIG = {
    Canvas: {
        polygonBackends: {
            move: {
                testCollision: jest.fn(() => false)
            }
        }
    }
};

global.game = {
    actors: {
        filter: jest.fn()
    }
};

global.ui = {
    notifications: {
        warn: jest.fn(),
        info: jest.fn()
    }
};

global.Dialog = jest.fn(function(dialogData) {
    this.render = jest.fn();
    this.data = dialogData;
});

describe("Party Sheet Deploy Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.canvas.tokens.controlled = [];
        global.canvas.regions.placeables = [];
        global.CONFIG.Canvas.polygonBackends.move.testCollision.mockReturnValue(false);
    });

    test("should warn if no token is selected", () => {
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith("Please select the Party Token first!");
    });

    test("should show direction picker and deploy sequentially without rotation", async () => {
        const deleteMock = jest.fn();
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: deleteMock },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        
        const actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);

        expect(Dialog).toHaveBeenCalled();
        const dialogData = Dialog.mock.calls[0][0];
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };

        // Simulate clicking 'North' (Facing North means growing South)
        await dialogData.buttons.north.callback(mockHtml);
        
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        // H1 in footprint (500,500)
        // H2 should be neighbor BEHIND H1 (South) -> (500,600)
        expect(created[0].x).toBe(500); expect(created[0].y).toBe(500);
        expect(created[1].x).toBe(500); expect(created[1].y).toBe(600);
        expect(deleteMock).toHaveBeenCalled();
    });

    test("should force single file contiguously", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        
        const actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } },
            { id: 'a3', name: 'H3', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H3' }) } }
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: true }]) };
        await Dialog.mock.calls[0][0].buttons.north.callback(mockHtml);

        // Single file North facing: (500,500) -> (500,600) -> (500,700)
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toEqual([
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 }),
            expect.objectContaining({ x: 500, y: 700 })
        ]);
    });

    test("should fill large footprint greedily", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 2, height: 2, delete: jest.fn() },
            center: { x: 600, y: 600 }
        };
        global.canvas.tokens.controlled = [leader];
        
        const actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };
        // Facing East (+X): Opp=West(-1,0), CW=North(0,-1), CW=East(1,0), CW=South(0,1)
        await Dialog.mock.calls[0][0].buttons.east.callback(mockHtml);

        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        // H1: (500,500)
        // H2: neighbor of H1 in East footprint. Order: [W, N, E, S]. 
        // W, N are out/used. E (+1,0) is available in footprint -> (600,500)
        expect(created[0].x).toBe(500); expect(created[0].y).toBe(500);
        expect(created[1].x).toBe(600); expect(created[1].y).toBe(500);
    });
});
