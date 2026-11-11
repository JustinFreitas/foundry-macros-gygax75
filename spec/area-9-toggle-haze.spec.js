const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/area-9-toggle-haze.js'), 'utf8');

describe('Area 9: Toggle Haze Macro', () => {
    beforeEach(() => {
        global.CONST = {
            ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0, CONDITIONAL: 1, ALWAYS: 2 },
        };
        global.ChatMessage = {
            create: jest.fn(),
            getSpeaker: jest.fn(() => ({ alias: 'Hero' })),
        };
        global.ui = {
            notifications: {
                warn: jest.fn(),
                info: jest.fn(),
            },
        };
    });

    test('applies Haze with system.thac0.mod.missile (-1) and showIcon ALWAYS, then restores on toggle off', async () => {
        const flags = {};
        const effects = [];
        const token = {
            name: 'Hero',
            document: {
                light: { bright: 30, dim: 60, color: null, alpha: 0.5 },
                getFlag: jest.fn((scope, key) => flags[`${scope}.${key}`]),
                setFlag: jest.fn(async (scope, key, val) => {
                    flags[`${scope}.${key}`] = val;
                }),
                unsetFlag: jest.fn(async (scope, key) => {
                    delete flags[`${scope}.${key}`];
                }),
                update: jest.fn(async () => {}),
            },
            actor: {
                effects,
                createEmbeddedDocuments: jest.fn(async (_kind, docs) => {
                    docs.forEach((doc) => {
                        const eff = {
                            ...doc,
                            delete: jest.fn(async () => {
                                const idx = effects.indexOf(eff);
                                if (idx !== -1) effects.splice(idx, 1);
                            }),
                        };
                        effects.push(eff);
                    });
                }),
            },
        };

        global.canvas = { tokens: { controlled: [token] } };

        // Toggle ON
        await eval(macroScript);
        expect(token.document.update).toHaveBeenCalledWith({
            'light.bright': 15,
            'light.dim': 30,
            'light.color': '#e6c8a0',
            'light.alpha': 0.35,
        });
        const [kind, docs] = token.actor.createEmbeddedDocuments.mock.calls[0];
        expect(kind).toBe('ActiveEffect');
        expect(docs[0]).toEqual({
            name: 'Haze',
            img: 'icons/magic/air/fog-gas-smoke-dense-gray.webp',
            showIcon: 2,
            system: {
                changes: [
                    { key: 'system.thac0.mod.missile', type: 'add', value: -1, priority: 20 },
                ],
            },
        });

        // Toggle OFF
        await eval(macroScript);
        expect(token.document.update).toHaveBeenLastCalledWith({
            'light.bright': 30,
            'light.dim': 60,
            'light.color': null,
            'light.alpha': 0.5,
        });
        expect(effects.length).toBe(0);
    });
});
