const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/apply-effect-blessed.js'), 'utf8');

class MockDialogV2 {
    static instances = [];
    constructor(config) {
        this.config = config;
        this.element = document.createElement('div');
        this.element.innerHTML = config.content;
        this.render = jest.fn();
        this.addEventListener = jest.fn();
        MockDialogV2.instances.push(this);
    }
}

describe('Apply Effect: Blessed Macro', () => {
    beforeEach(() => {
        MockDialogV2.instances = [];
        global.CONST = {
            ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0, CONDITIONAL: 1, ALWAYS: 2 },
        };
        global.foundry = {
            applications: {
                api: {
                    DialogV2: MockDialogV2,
                },
            },
        };
        global.ui = {
            notifications: {
                warn: jest.fn(),
                info: jest.fn(),
            },
        };
    });

    test('overrides monster numeric string morale cleanly without string concatenation and adds retainer loyalty', async () => {
        const monster = {
            name: 'Goblin',
            type: 'monster',
            system: { details: { morale: '8' } },
            createEmbeddedDocuments: jest.fn(async () => {}),
        };
        const variedMonster = {
            name: 'Chaos Beast',
            type: 'monster',
            system: { details: { morale: 'Varies' } },
            createEmbeddedDocuments: jest.fn(async () => {}),
        };
        const retainer = {
            name: 'Squire',
            type: 'character',
            system: { retainer: { enabled: true } },
            createEmbeddedDocuments: jest.fn(async () => {}),
        };

        global.canvas = {
            tokens: {
                controlled: [
                    { name: 'Goblin', actor: monster },
                    { name: 'Chaos Beast', actor: variedMonster },
                    { name: 'Squire', actor: retainer },
                ],
            },
        };

        await eval(macroScript);
        expect(MockDialogV2.instances.length).toBe(1);
        const dlg = MockDialogV2.instances[0];
        expect(dlg.config.classes).toEqual(['ose', 'dialog']);
        expect(dlg.config.position).toEqual({ width: 400, height: 'auto' });

        const applyBtn = dlg.config.buttons.find((b) => b.action === 'apply');
        await applyBtn.callback(null, null, dlg);

        // Monster numeric morale "8" + 1 -> override "9" (never "81")
        const monsterDoc = monster.createEmbeddedDocuments.mock.calls[0][1][0];
        expect(monsterDoc.img).toBe('icons/svg/sun.svg');
        expect(monsterDoc.icon).toBeUndefined();
        expect(monsterDoc.showIcon).toBe(2);
        expect(monsterDoc.duration).toEqual({ value: 3600, units: 'seconds' });
        expect(monsterDoc.system.changes).toContainEqual({
            key: 'system.details.morale',
            type: 'override',
            value: '9',
            priority: 20,
        });

        // Non-numeric morale skipped safely
        const variedDoc = variedMonster.createEmbeddedDocuments.mock.calls[0][1][0];
        expect(variedDoc.system.changes.some((c) => c.key === 'system.details.morale')).toBe(false);

        // Retainer gets loyalty add
        const retainerDoc = retainer.createEmbeddedDocuments.mock.calls[0][1][0];
        expect(retainerDoc.system.changes).toContainEqual({
            key: 'system.retainer.loyalty',
            type: 'add',
            value: 1,
            priority: 20,
        });
    });
});
