const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/slowest-dungeon-speed.js'), 'utf8');

describe('SlowestDungeonSpeed', () => {
    let game;
    let ChatMessage;

    beforeEach(() => {
        const actor1 = {
            name: 'Fighter',
            flags: { ose: { party: true } },
            system: { details: { class: 'Fighter' }, movement: { base: 90 } }
        };
        const actor2 = {
            name: 'Dwarf',
            flags: { ose: { party: true } },
            system: { details: { class: 'Dwarf' }, movement: { base: 60 } }
        };
        const mule = {
            name: 'Mule',
            flags: { ose: { party: true } },
            system: {
                details: { class: 'Mule' },
                encumbrance: { value: 1000, max: 3000 },
                movement: { base: 0 }
            },
            update: jest.fn()
        };

        game = {
            actors: {
                filter: jest.fn().mockReturnValue([actor1, actor2, mule])
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
    });

    test('should report the slowest dungeon speed', () => {
        eval(macroScript);

        expect(ChatMessage.create).toHaveBeenCalled();
        const message = ChatMessage.create.mock.calls[0][0].content;
        expect(message).toContain('<h2>Character Speed Report</h2>');
        expect(message).toContain("The party's slowest speed is <b>60ft</b> / <b>12 miles</b> per turn.");
        expect(message).toContain('Characters: Dwarf');
    });
});
