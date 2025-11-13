const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/close-all-doors-current-scene.js'), 'utf8');

global.game = {
    canvas: {
        walls: {
            doors: []
        }
    },
    userId: '123'
};

global.ChatMessage = {
    _created: [],
    create: jest.fn(function(message) {
        this._created.push(message);
    }),
    getCreated: jest.fn(function() {
        return this._created;
    }),
    clear: jest.fn(function() {
        this._created = [];
    })
};

describe("Close All Doors In Current Scene Macro", () => {

    beforeEach(() => {
        game.canvas.walls.doors = [];
        ChatMessage.clear();
    });

    test("should report 'No Open Doors Found' if there are no open doors", async () => {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('No Open Doors Found');
    });

    test("should close all open doors and report the number of closed doors", async () => {
        const openDoors = [
            { isDoor: true, isOpen: true, document: { update: jest.fn() } },
            { isDoor: true, isOpen: true, document: { update: jest.fn() } },
        ];
        game.canvas.walls.doors = openDoors;

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('All Open Doors Closed (2)');
        expect(openDoors[0].document.update).toHaveBeenCalledWith({ds: 0});
        expect(openDoors[1].document.update).toHaveBeenCalledWith({ds: 0});
    });
});
