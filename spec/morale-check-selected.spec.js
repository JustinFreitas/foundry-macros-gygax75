const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/morale-check-selected.js'), 'utf8');

describe('MoraleCheckSelected', () => {
    let CONST, ChatMessage;

    // Actor double whose rollMorale returns a controllable total.
    const makeActor = (name, { morale = '8', type = 'monster', moraleTotal = 7, effects = [], system = {} } = {}) => {
        const eff = [...effects];
        return {
            name,
            type,
            system: { details: { morale }, ...system },
            effects: eff,
            rollMorale: jest.fn(async () => ({ total: moraleTotal })),
            createEmbeddedDocuments: jest.fn(async (kind, docs) => {
                docs.forEach(doc => eff.push({
                    id: `effect-${eff.length}`,
                    name: doc.name,
                    statuses: new Set(doc.statuses ?? []),
                    changes: doc.changes ?? [],
                    flags: doc.flags ?? {},
                }));
            }),
        };
    };

    const makeToken = (actor) => ({ actor, name: actor?.name });

    const makeFleeingEffect = () => ({
        id: 'existing-fleeing',
        name: 'Fleeing',
        statuses: new Set(['fleeing']),
    });

    beforeEach(() => {
        CONST = {
            ACTIVE_EFFECT_MODES: { ADD: 2 },
            ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0, CONDITIONAL: 1, ALWAYS: 2 },
        };
        ChatMessage = { create: jest.fn() };
    });

    const run = (canvas) => eval(`(async () => { ${macroScript} })()`);
    const lastContent = () => ChatMessage.create.mock.calls.at(-1)[0].content;

    test('reports when no tokens selected', async () => {
        await run({ tokens: { controlled: [] } });
        expect(lastContent()).toContain('No tokens selected.');
    });

    test('failed morale applies Fleeing and reports the flee', async () => {
        const m = makeActor('Goblin', { morale: '7', moraleTotal: 10 }); // 10 > 7 -> fail
        await run({ tokens: { controlled: [makeToken(m)] } });

        expect(m.rollMorale).toHaveBeenCalled();
        const [type, docs] = m.createEmbeddedDocuments.mock.calls[0];
        expect(type).toBe('ActiveEffect');
        expect(docs[0].name).toBe('Fleeing');
        expect(docs[0].changes).toEqual([{ key: 'system.aac.mod', mode: 2, value: -1 }]);
        const content = lastContent();
        expect(content).toContain('Morale FAILED');
        expect(content).toContain('rolled 10 vs 7');
        expect(content).toContain('Fleeing applied');
    });

    test('passed morale does not apply Fleeing', async () => {
        const m = makeActor('Orc', { morale: '9', moraleTotal: 6 }); // 6 <= 9 -> hold
        await run({ tokens: { controlled: [makeToken(m)] } });

        expect(m.createEmbeddedDocuments).not.toHaveBeenCalled();
        expect(lastContent()).toContain('Morale held');
    });

    test('boundary: total equal to morale is a pass (<=)', async () => {
        const m = makeActor('Hobgoblin', { morale: '8', moraleTotal: 8 }); // 8 <= 8 -> hold
        await run({ tokens: { controlled: [makeToken(m)] } });
        expect(m.createEmbeddedDocuments).not.toHaveBeenCalled();
        expect(lastContent()).toContain('Morale held');
    });

    test('does not double-apply Fleeing to an already-fleeing creature', async () => {
        const m = makeActor('Goblin', { morale: '5', moraleTotal: 11, effects: [makeFleeingEffect()] });
        await run({ tokens: { controlled: [makeToken(m)] } });
        expect(m.createEmbeddedDocuments).not.toHaveBeenCalled(); // already fleeing
        expect(lastContent()).toContain('Morale FAILED');
    });

    test('skips PCs (characters make their own decisions)', async () => {
        const c = makeActor('Hero', { type: 'character', moraleTotal: 12 });
        await run({ tokens: { controlled: [makeToken(c)] } });
        expect(c.rollMorale).not.toHaveBeenCalled();
        expect(lastContent()).toContain('Skipped (PCs');
    });

    test('skips non-numeric morale without rolling', async () => {
        const m = makeActor('Merchant', { morale: 'Varies' });
        await run({ tokens: { controlled: [makeToken(m)] } });
        expect(m.rollMorale).not.toHaveBeenCalled();
        expect(lastContent()).toContain('non-numeric morale');
    });

    test('skips tokens without an actor', async () => {
        const empty = { actor: null, name: 'Empty Token' };
        await run({ tokens: { controlled: [empty] } });
        expect(lastContent()).toContain('<b>Empty Token:</b>  Skipped (no actor).');
    });
});
