global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/fleeing.js'), 'utf8');

describe('Fleeing', () => {
    let CONFIG, CONST, ChatMessage, ui;

    // Minimal actor double: an `effects` array (with Array.find) whose entries
    // expose a `statuses` Set, plus create/delete that mutate the array. Mirrors
    // the Bless spec harness.
    const makeActor = (name, { effects = [], system = {}, type = 'character' } = {}) => {
        const eff = [...effects];
        return {
            name,
            type,
            system,
            effects: eff,
            createEmbeddedDocuments: jest.fn(async (kind, docs) => {
                docs.forEach(doc => eff.push({
                    id: `effect-${eff.length}`,
                    name: doc.name,
                    statuses: new Set(doc.statuses ?? []),
                    changes: doc.changes ?? [],
                    flags: doc.flags ?? {},
                }));
            }),
            deleteEmbeddedDocuments: jest.fn(async (kind, ids) => {
                ids.forEach(id => {
                    const idx = eff.findIndex(e => e.id === id);
                    if (idx !== -1) eff.splice(idx, 1);
                });
            }),
        };
    };

    const makeToken = (actor) => ({ actor, name: actor?.name });

    const makeFleeingEffect = (fleeingAc = -1) => ({
        id: 'existing-fleeing',
        name: 'Fleeing',
        statuses: new Set(['fleeing']),
        changes: fleeingAc ? [{ key: 'system.aac.mod', mode: 2, value: fleeingAc }] : [],
        flags: { ose: { fleeingAc } },
    });

    beforeEach(() => {
        CONFIG = {};
        CONST = {
            ACTIVE_EFFECT_MODES: { ADD: 2 },
            ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0, CONDITIONAL: 1, ALWAYS: 2 },
        };
        ChatMessage = { create: jest.fn() };
        ui = { notifications: { warn: jest.fn() } };
    });

    const run = (canvas) => eval(`(async () => { ${macroScript} })()`);
    const lastContent = () => ChatMessage.create.mock.calls.at(-1)[0].content;

    describe('applying', () => {
        test('character forfeits its equipped shield bonus on aac.mod', async () => {
            const a = makeActor('Fighter', { system: { aac: { shield: 2 } } });
            const canvas = { tokens: { controlled: [makeToken(a)] } };

            await run(canvas);

            const [type, docs] = a.createEmbeddedDocuments.mock.calls[0];
            expect(type).toBe('ActiveEffect');
            expect(docs[0].name).toBe('Fleeing');
            expect(docs[0].statuses).toEqual(['fleeing']);
            expect(docs[0].showIcon).toBe(2);
            // Shield bonus 2 -> AC worsens by 2 (negative on ascending aac.mod).
            expect(docs[0].changes).toEqual([{ key: 'system.aac.mod', mode: 2, value: -2 }]);
            expect(docs[0].flags).toEqual({ ose: { fleeingAc: -2 } });

            const content = lastContent();
            expect(content).toContain('<b>Fighter:</b>  Adding Fleeing');
            expect(content).toContain('AC penalty 2');
            expect(content).toContain('+2 to hit'); // DM reminder always present
        });

        test('character with no shield applies no AC change', async () => {
            const a = makeActor('Wizard', { system: { aac: { shield: 0 } } });
            const canvas = { tokens: { controlled: [makeToken(a)] } };

            await run(canvas);

            const [, docs] = a.createEmbeddedDocuments.mock.calls[0];
            expect(docs[0].changes).toEqual([]);
            expect(docs[0].flags).toEqual({ ose: { fleeingAc: 0 } });
            expect(lastContent()).toContain('no shield to forfeit');
        });

        test('monster uses the flat 1-point shield-equivalent', async () => {
            const m = makeActor('Goblin', { system: {}, type: 'monster' });
            const canvas = { tokens: { controlled: [makeToken(m)] } };

            await run(canvas);

            const [, docs] = m.createEmbeddedDocuments.mock.calls[0];
            expect(docs[0].changes).toEqual([{ key: 'system.aac.mod', mode: 2, value: -1 }]);
            expect(docs[0].flags).toEqual({ ose: { fleeingAc: -1 } });
        });
    });

    describe('removing', () => {
        test('toggling off deletes the effect and reports restoration', async () => {
            const a = makeActor('Fighter', { effects: [makeFleeingEffect(-2)], system: { aac: { shield: 2 } } });
            const canvas = { tokens: { controlled: [makeToken(a)] } };

            await run(canvas);

            expect(a.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['existing-fleeing']);
            expect(a.createEmbeddedDocuments).not.toHaveBeenCalled();
            const content = lastContent();
            expect(content).toContain('Removing Fleeing');
            expect(content).toContain('AC restored 2');
        });

        test('removal of a no-shield effect reports no AC restoration', async () => {
            const a = makeActor('Wizard', { effects: [makeFleeingEffect(0)], system: { aac: { shield: 0 } } });
            const canvas = { tokens: { controlled: [makeToken(a)] } };

            await run(canvas);

            expect(a.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['existing-fleeing']);
            expect(lastContent()).toContain('no shield to forfeit');
        });
    });

    describe('common', () => {
        test('reports when no tokens are selected', async () => {
            const canvas = { tokens: { controlled: [] } };
            await run(canvas);
            expect(lastContent()).toContain('No tokens selected.');
        });

        test('skips tokens without an actor', async () => {
            const a = makeActor('Fighter', { system: { aac: { shield: 1 } } });
            const empty = { actor: null, name: 'Empty Token' };
            const canvas = { tokens: { controlled: [makeToken(a), empty] } };

            await run(canvas);

            expect(lastContent()).toContain('<b>Empty Token:</b>  Skipped (no actor).');
        });

        test('every report includes the usage section', async () => {
            const canvas = { tokens: { controlled: [] } };
            await run(canvas);
            const content = lastContent();
            expect(content).toContain('<details>');
            expect(content).toContain('How to use Fleeing');
        });
    });
});
