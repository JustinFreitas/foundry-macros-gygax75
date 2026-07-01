global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/casting.js'), 'utf8');

describe('Casting', () => {
    let CONFIG, ChatMessage, game, ui;

    // Actor double: toggleStatusEffect flips membership in a `statuses` Set, the
    // same place the macro reads back from to mirror onto the combatant flag.
    const makeActor = (name, { statuses = [] } = {}) => {
        const set = new Set(statuses);
        return {
            name,
            statuses: set,
            effects: [],
            toggleStatusEffect: jest.fn(async (id) => {
                if (set.has(id)) set.delete(id);
                else set.add(id);
            }),
        };
    };

    // Token with an attached combatant exposing the isCasting getter/setter
    // (mirrors OSECombatant.isCasting <-> prepareSpell flag).
    const makeCombatant = () => {
        let casting = false;
        return {
            get isCasting() { return casting; },
            set isCasting(v) { casting = v; },
        };
    };

    const makeToken = (actor, { combatant = null, id = 'tok' } = {}) => ({ actor, name: actor?.name, id, combatant });

    beforeEach(() => {
        CONFIG = { statusEffects: [{ id: 'casting', name: 'Casting' }] };
        ChatMessage = { create: jest.fn() };
        game = { combat: null };
        ui = { notifications: { warn: jest.fn() } };
    });

    const run = (canvas) => eval(`(async () => { ${macroScript} })()`);

    test('warns when no tokens selected', async () => {
        await run({ tokens: { controlled: [] } });
        expect(ui.notifications.warn).toHaveBeenCalled();
    });

    test('toggles the casting status on each selected token', async () => {
        const a = makeActor('Cleric');
        await run({ tokens: { controlled: [makeToken(a)] } });
        expect(a.toggleStatusEffect).toHaveBeenCalledWith('casting');
        expect(a.statuses.has('casting')).toBe(true);
    });

    test('sets combatant.isCasting true when status turns on', async () => {
        const a = makeActor('Cleric');
        const combatant = makeCombatant();
        await run({ tokens: { controlled: [makeToken(a, { combatant })] } });
        expect(combatant.isCasting).toBe(true);
    });

    test('clears combatant.isCasting when status turns off', async () => {
        const a = makeActor('Cleric', { statuses: ['casting'] }); // already casting -> toggle off
        const combatant = makeCombatant();
        combatant.isCasting = true;
        await run({ tokens: { controlled: [makeToken(a, { combatant })] } });
        expect(a.statuses.has('casting')).toBe(false);
        expect(combatant.isCasting).toBe(false);
    });

    test('falls back to game.combat.getCombatantByToken when token.combatant is absent', async () => {
        const a = makeActor('Cleric');
        const combatant = makeCombatant();
        game.combat = { getCombatantByToken: jest.fn(() => combatant) };
        await run({ tokens: { controlled: [makeToken(a, { combatant: null, id: 'tok-1' })] } });
        expect(game.combat.getCombatantByToken).toHaveBeenCalledWith('tok-1');
        expect(combatant.isCasting).toBe(true);
    });

    test('skips the flag step gracefully when there is no combat', async () => {
        const a = makeActor('Cleric');
        // No combatant, no game.combat -> should still toggle status without throwing.
        await expect(run({ tokens: { controlled: [makeToken(a)] } })).resolves.not.toThrow();
        expect(a.statuses.has('casting')).toBe(true);
    });

    test('ignores tokens without an actor', async () => {
        const empty = { actor: null, name: 'Empty', id: 'e' };
        await expect(run({ tokens: { controlled: [empty] } })).resolves.not.toThrow();
    });
});
