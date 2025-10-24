const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/unlock-all-doors-active-scene.js'), 'utf8');

describe('UnlockAllDoorsActiveScene', () => {
    let game;
    let ChatMessage;

    beforeEach(() => {
        const lockedDoor = {
            door: 1,
            ds: 2, // Locked
            update: jest.fn()
        };
        const unlockedDoor = {
            door: 1,
            ds: 0, // Unlocked
            update: jest.fn()
        };
        const wall = {
            door: 0
        };

        game = {
            scenes: {
                active: {
                    walls: [lockedDoor, unlockedDoor, wall]
                }
            },
            userId: '123'
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
    });

    test('should unlock all locked doors and create a chat message', async () => {
        await eval(`(async () => { ${macroScript} })()`);

        const lockedDoor = game.scenes.active.walls[0];
        expect(lockedDoor.update).toHaveBeenCalledWith({ ds: 0 });

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h4>All Locked Doors Unlocked (1)</h4>');
    });

    test('should report no locked doors if none are found', async () => {
        game.scenes.active.walls = game.scenes.active.walls.filter(w => w.ds !== 2);
        await eval(`(async () => { ${macroScript} })()`);

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h4>No Locked Doors Found</h4>');
    });
});
