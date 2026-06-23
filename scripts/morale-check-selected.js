// Roll morale (2d6 vs. the creature's morale score) for each selected monster
// token and, on a FAILED check, automatically apply the Fleeing condition.
//
// Rules Cyclopedia (Ch.8, Morale): the DM rolls 2d6 against the creature's
// morale score; "If 2d6 roll is equal to or less than morale score, creature
// pursues combat; otherwise, it avoids combat" (flee/cease-fire/surrender).
// Morale checks are triggered at defined moments (first hit, quarter HP, first
// death on either side, half the side unable to act, etc.) -- this macro is the
// DM's button for "run that check now on the selected creatures."
//
// On failure we apply the same Fleeing ActiveEffect that the Fleeing macro
// builds (shield-AC forfeit). Foundry macros can't import one another, so the
// effect-creation below is intentionally kept identical to scripts/fleeing.js;
// if you change one, change both. Only the AC-forfeit half of the rule is
// automatable (see fleeing.js for why the enemy +2-to-hit is a DM reminder).

const STATUS_ID = 'fleeing';
const FLEEING_IMG = 'forge-migration/bazaar/systems/pf2e/assets/icons/conditions/doomed.webp'; // local mirror; matches scripts/fleeing.js / Fleeing condition
const MONSTER_SHIELD_VALUE = 1; // matches scripts/fleeing.js

const reportContent = (body) => `<h2>Morale Check Report</h2>${body}`;

const findFleeing = (actor) => actor.effects.find(e => e.statuses?.has(STATUS_ID) || e.name === 'Fleeing');

// Apply Fleeing (idempotent: no-op if already fleeing). Mirrors fleeing.js.
const applyFleeing = async (actor) => {
    if (findFleeing(actor)) return;
    const penalty = actor.type === 'monster' ? MONSTER_SHIELD_VALUE : (Number(actor.system?.aac?.shield) || 0);
    const acDelta = -penalty || 0; // collapse -0
    const changes = penalty > 0
        ? [{ key: 'system.aac.mod', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: acDelta }]
        : [];
    await actor.createEmbeddedDocuments('ActiveEffect', [{
        name: 'Fleeing',
        img: FLEEING_IMG,
        statuses: [STATUS_ID],
        showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
        changes,
        flags: { ose: { fleeingAc: acDelta } },
    }]);
};

const controlled = canvas.tokens.controlled;
if (controlled.length === 0) {
    ChatMessage.create({ content: reportContent('No tokens selected.') });
    return;
}

const lines = [];

for (const token of controlled) {
    const actor = token.actor;
    if (!actor) {
        lines.push(`<b>${token.name ?? 'Unknown token'}:</b>  Skipped (no actor).<br/>`);
        continue;
    }
    if (actor.type !== 'monster') {
        lines.push(`<b>${actor.name}:</b>  Skipped (PCs make their own morale decisions).<br/>`);
        continue;
    }

    // Only creatures with a clean numeric morale score check (skip "Varies",
    // "7(12)", blank, etc.) -- same guard as the Bless macro's morale handling.
    const raw = actor.system?.details?.morale;
    const morale = Number.parseInt(raw, 10);
    if (!Number.isInteger(morale) || String(morale) !== String(raw ?? '').trim()) {
        lines.push(`<b>${actor.name}:</b>  Skipped (non-numeric morale "${raw ?? ''}").<br/>`);
        continue;
    }

    // rollMorale posts its own 2d6-vs-morale chat card and returns the evaluated
    // Roll. Morale is a "below" check: success = total <= morale, fail = total >
    // morale (RC). On failure the creature flees.
    const roll = await actor.rollMorale();
    const total = roll?.total;
    const failed = typeof total === 'number' && total > morale;

    if (failed) {
        await applyFleeing(actor);
        lines.push(`<b>${actor.name}:</b>  Morale FAILED (rolled ${total} vs ${morale}) &mdash; flees (Fleeing applied).<br/>`);
    } else {
        lines.push(`<b>${actor.name}:</b>  Morale held (rolled ${total ?? '?'} vs ${morale}).<br/>`);
    }
}

ChatMessage.create({ content: reportContent(lines.join('<br/>')) });
