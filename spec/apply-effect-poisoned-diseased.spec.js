const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/apply-effect-poisoned-diseased.js'), 'utf8');

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

describe('Apply Effect: Poisoned / Diseased Macro', () => {
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
        global.ChatMessage = { create: jest.fn() };
        global.ui = {
            notifications: {
                warn: jest.fn(),
            },
        };
    });

    test('applies HP damage and duration-less ActiveEffect with showIcon ALWAYS and no deprecated icon field', async () => {
        const actor = {
            name: 'Fighter',
            system: { hp: { value: 12, max: 15 } },
            update: jest.fn(async () => {}),
            createEmbeddedDocuments: jest.fn(async () => {}),
        };
        global.canvas = { tokens: { controlled: [{ name: 'Fighter', actor }] } };

        await eval(macroScript);
        expect(MockDialogV2.instances.length).toBe(1);
        const dlg = MockDialogV2.instances[0];
        expect(dlg.config.classes).toEqual(['ose', 'dialog']);
        expect(dlg.config.position).toEqual({ width: 400, height: 'auto' });

        const applyBtn = dlg.config.buttons.find((b) => b.action === 'apply');
        await applyBtn.callback(null, null, dlg);

        expect(actor.update).toHaveBeenCalledWith({ 'system.hp.value': 7 });
        const effectDoc = actor.createEmbeddedDocuments.mock.calls[0][1][0];
        expect(effectDoc).toEqual({
            name: 'Poisoned / Diseased',
            img: 'icons/svg/poison.svg',
            showIcon: 2,
            flags: { ose: { preventsHealing: true } },
            description: 'Poisoned/Diseased: cannot be healed until cured.',
        });
        expect(effectDoc.icon).toBeUndefined();
    });
});
