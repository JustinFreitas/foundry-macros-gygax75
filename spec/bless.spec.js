global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/bless.js'), 'utf8');

describe('Bless Macro', () => {
    let CONST, ChatMessage, game;

    const makeActor = (name, { type = 'character', morale = '8', retainerEnabled = false, effects = [] } = {}) => {
        const eff = [...effects];
        const actor = {
            name,
            type,
            system: {
                details: { morale },
                retainer: { enabled: retainerEnabled },
            },
            effects: eff,
            update: jest.fn(async (patch) => {
                if ('system.details.morale' in patch) {
                    actor.system.details.morale = patch['system.details.morale'];
                }
            }),
            createEmbeddedDocuments: jest.fn(async (_kind, docs) => {
                docs.forEach((doc) => {
                    eff.push({
                        id: `effect-${eff.length}`,
                        name: doc.name,
                        img: doc.img,
                        statuses: new Set(doc.statuses ?? []),
                        showIcon: doc.showIcon,
                        system: { changes: doc.system?.changes ?? [] },
                        flags: doc.flags ?? {},
                    });
                });
            }),
            deleteEmbeddedDocuments: jest.fn(async (_kind, ids) => {
                ids.forEach((id) => {
                    const idx = eff.findIndex((e) => e.id === id);
                    if (idx !== -1) eff.splice(idx, 1);
                });
            }),
        };
        return actor;
    };

    const makeToken = (actor, disposition = 1) => ({
        actor,
        name: actor?.name ?? 'Unnamed',
        document: { disposition },
    });

    beforeEach(() => {
        CONST = {
            ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0, CONDITIONAL: 1, ALWAYS: 2 },
        };
        ChatMessage = { create: jest.fn() };
        game = { user: { targets: new Set() } };
    });

    const run = (canvas) => eval(`(async () => { ${macroScript} })()`);
    const lastContent = () => ChatMessage.create.mock.calls.at(-1)[0].content;

    test('applies melee/missile attack AND damage bonuses (+1 each) using V14 ActiveEffect schema and verified core icon', async () => {
        const fighter = makeActor('Fighter');
        await run({ tokens: { controlled: [makeToken(fighter)] } });

        const [kind, docs] = fighter.createEmbeddedDocuments.mock.calls[0];
        expect(kind).toBe('ActiveEffect');
        expect(docs[0].name).toBe('Bless');
        expect(docs[0].img).toBe('icons/magic/life/ankh-gold-blue.webp');
        expect(docs[0].showIcon).toBe(2);
        expect(docs[0].system.changes).toEqual([
            { key: 'system.thac0.mod.melee', type: 'add', value: 1 },
            { key: 'system.thac0.mod.missile', type: 'add', value: 1 },
            { key: 'system.damage.mod.melee', type: 'add', value: 1 },
            { key: 'system.damage.mod.missile', type: 'add', value: 1 },
        ]);
        expect(lastContent()).toContain('Adding Bless (+1 attack/damage)');
    });

    test('adds +1 loyalty for retainers and detects it from existing.system.changes on removal', async () => {
        const retainer = makeActor('Torchbearer', { retainerEnabled: true });
        const token = makeToken(retainer);

        await run({ tokens: { controlled: [token] } });
        const [, docs] = retainer.createEmbeddedDocuments.mock.calls[0];
        expect(docs[0].system.changes).toContainEqual({
            key: 'system.retainer.loyalty',
            type: 'add',
            value: 1,
        });
        expect(lastContent()).toContain('+1 loyalty');

        // Toggle off — even if retainer.enabled later changed, removal reads existing.system.changes
        retainer.system.retainer.enabled = false;
        await run({ tokens: { controlled: [token] } });
        expect(retainer.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['effect-0']);
        expect(lastContent()).toContain('Removing Bless (+1 attack/damage, +1 loyalty)');
    });

    test('caster mode blesses caster + targets and only grants monster morale to matching disposition', async () => {
        const cleric = makeActor('Evil Cleric', { type: 'monster', morale: '9' });
        const allyOrc = makeActor('Orc', { type: 'monster', morale: '8' });
        const hostileGuard = makeActor('Guard', { type: 'monster', morale: '7' });

        const clericTok = makeToken(cleric, -1);
        const orcTok = makeToken(allyOrc, -1);
        const guardTok = makeToken(hostileGuard, 1);
        game.user.targets = new Set([orcTok, guardTok]);

        await run({ tokens: { controlled: [clericTok] } });

        expect(cleric.system.details.morale).toBe('10');
        expect(allyOrc.system.details.morale).toBe('9');
        expect(hostileGuard.system.details.morale).toBe('7');
    });
});
