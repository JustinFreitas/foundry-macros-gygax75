const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/register-world-setting.js'), 'utf8');

describe('RegisterWorldSetting', () => {
    let game;

    beforeEach(() => {
        game = {
            settings: {
                register: jest.fn()
            }
        };
        global.game = game;
    });

    test('should register the world setting', () => {
        eval(macroScript);

        expect(game.settings.register).toHaveBeenCalledWith("ose", "upkeepStartDate", {
            scope: "world",
            config: false,
            requiresReload: false,
            default: '',
            onChange: expect.any(Function)
        });
    });
});
