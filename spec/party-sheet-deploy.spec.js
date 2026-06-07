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

    test("should show direction picker and deploy in chosen direction without rotation", async () => {
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
        
        // Mock HTML for finding the checkbox
        const mockHtml = {
            find: jest.fn().mockReturnValue([{ checked: false }])
        };

        // Simulate clicking 'North'
        await dialogData.buttons.north.callback(mockHtml);
        
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        expect(deleteMock).toHaveBeenCalled();
    });

    test("should force single file if checkbox is checked", async () => {
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
        
        // Mock HTML with Single File CHECKED
        const mockHtml = {
            find: jest.fn().mockReturnValue([{ checked: true }])
        };
        
        await Dialog.mock.calls[0][0].buttons.north.callback(mockHtml);

        // North direction (0,-1). 
        // Footprint: (500,500)
        // Neighbors: (600,500), (400,500), (500,600), (500,400)
        // Lanes: Side Dist <= 0.1 and Forward Dist <= 0.1
        // (500,600) is Lane (distF=0, distB=1)
        // (500,700) is Lane (distF=-1, distB=2)
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toEqual(expect.arrayContaining([
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 }),
            expect.objectContaining({ x: 500, y: 700 })
        ]));
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
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };
        await Dialog.mock.calls[0][0].buttons.east.callback(mockHtml);

        // For East (+X), front of footprint is (600, 500) and (600, 600)
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        expect(created).toEqual(expect.arrayContaining([
            expect.objectContaining({ x: 600, y: 500 }),
            expect.objectContaining({ x: 600, y: 600 })
        ]));
    });
});
