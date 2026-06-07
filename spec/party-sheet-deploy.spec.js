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

    test("should show direction picker and deploy in chosen direction with rotation", async () => {
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
        
        // Simulate clicking 'North' (rotation 0)
        await dialogData.buttons.north.callback();

        // H1: Footprint (500,500)
        // H2: Neighbor North (Side step first doesn't matter for 1x1 footprint logic, 
        // but BFS will find neighbors. For 1x1 footprint, (0,0) is filled. 
        // Then neighbors of (0,0) are checked.
        
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        expect(created[0]).toEqual(expect.objectContaining({ name: 'H1', x: 500, y: 500, rotation: 0 }));
        expect(deleteMock).toHaveBeenCalled();
    });

    test("should use 2x2 footprint if leader is 2x2", async () => {
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
        await Dialog.mock.calls[0][0].buttons.east.callback();

        // Should fill (0,0) and (0,1) or (1,0) depending on loop order
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toEqual(expect.arrayContaining([
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 })
        ]));
    });
});
