// Toggle a "Fleeing" (full Retreat) condition on the selected tokens, applying
// the rules-mandated mechanical penalty rather than just painting an icon.
//
// Rules Cyclopedia (Ch.8, Retreat): a fleeing character "forfeits the armor
// class bonus of his shield. Any enemy attacking him later in the combat round
// ... receives a +2 attack roll bonus this round."
//
// Two halves, only one of which is mechanically automatable in OSE:
//   * Shield-AC forfeit  -> applied here as a real AC penalty (see below).
//   * Enemy +2 to-hit    -> NOT applied. OSE puts to-hit mods on the ATTACKER,
//     and there is no actor-level lever for "everyone attacking THIS token gets
//     +2 this round." It is surfaced as a chat reminder for the DM instead.
//
// AC handling mirrors the Bless macro's pattern (build the AE in the macro,
// record what was applied in a flag, reverse it exactly on removal) because the
// penalty magnitude is per-actor and cannot live in a static CLT condition:
//   * Characters: the real equipped-shield bonus is exposed as a computed getter
//     `actor.system.aac.shield` (0 if no shield equipped). See
//     ose-foundry-core-gygax75/src/module/actor/data-model-classes/data-model-character-ac.ts.
//   * Monsters: AC is a single number with no shield breakdown (untyped
//     ObjectField; see data-model-monster.js), so there is nothing to "read and
//     forfeit." We apply the standard OSE shield value of 1 point instead.
//
// The penalty is written to `system.aac.mod` (ascending AC: higher = better, so
// a penalty is NEGATIVE). The actor model mirrors aac.mod <-> ac.mod on update
// (entity.js update()), so targeting aac.mod covers both AC schemes. We persist
// the AE via createEmbeddedDocuments so it shows on the token + Effects tab, and
// stash the applied delta in flags.ose.fleeingAc for exact reversal.

const STATUS_ID = 'fleeing';
// Match the Fleeing CLT condition's icon (the "doomed" PF2e condition icon) so
// the macro-created AE looks like a hand-toggled one. Uses the LOCAL mirror
// under forge-migration/ (Data-relative) rather than a remote forge-vtt URL, so
// it works offline / after any move off Forge. Same scheme the Bless macro uses.
const FLEEING_IMG = 'forge-migration/bazaar/systems/pf2e/assets/icons/conditions/doomed.webp';
const MONSTER_SHIELD_VALUE = 1; // OSE shields grant +1 AC; monster AC has no shield breakdown to read.

const usageHtml = `
<details>
  <summary><i>How to use Fleeing</i></summary>
  <ul style="margin:0.3em 0; padding-left:1.2em;">
    <li><b>Apply / remove:</b> select one or more tokens and run to toggle Fleeing. The fleer <b>forfeits its shield's AC bonus</b> while Fleeing (characters: the equipped shield's value; monsters: 1 point). Re-running removes it and restores AC exactly.</li>
    <li><b>DM reminder (not automated):</b> any enemy attacking a fleeing target later in the round gets <b>+2 to hit</b> (same as attacking from behind). OSE applies to-hit bonuses to the attacker, so apply this by hand on the attack roll.</li>
  </ul>
</details>`;

const reportContent = (body) => `<h2>Toggle Fleeing Report</h2>${usageHtml}${body}`;

// Detect by the effect's `statuses` Set or its name (same approach as Bless).
const findFleeing = (actor) => actor.effects.find(e => e.statuses?.has(STATUS_ID) || e.name === 'Fleeing');

// The AC penalty magnitude for an actor: the real shield bonus for characters,
// a flat shield-equivalent for monsters (whose AC has no shield component).
const shieldPenaltyFor = (actor) => {
    if (actor.type === 'monster') return MONSTER_SHIELD_VALUE;
    const shield = Number(actor.system?.aac?.shield);
    return Number.isFinite(shield) ? shield : 0;
};

const controlled = canvas.tokens.controlled;
if (controlled.length === 0) {
    ChatMessage.create({ content: reportContent('No tokens selected.') });
    return;
}

const reportByActorName = new Map();
const skippedTokenNames = [];

for (const token of controlled) {
    const actor = token.actor;
    if (!actor) {
        skippedTokenNames.push(token.name ?? 'Unknown token');
        continue;
    }

    const existing = findFleeing(actor);
    if (existing) {
        // Reverse the AC penalty using the exact value the effect recorded, so
        // removal undoes the apply regardless of equipment changes since.
        const appliedAc = Number(existing.flags?.ose?.fleeingAc) || 0;
        await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
        reportByActorName.set(actor.name, { adding: false, ac: appliedAc });
    } else {
        const penalty = shieldPenaltyFor(actor);
        // Ascending AC: worse AC = lower aac, so subtract the shield bonus.
        // `|| 0` collapses -0 (from negating 0) to a clean 0.
        const acDelta = -penalty || 0;
        const changes = penalty > 0
            ? [{ key: 'system.aac.mod', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: acDelta }]
            : [];
        await actor.createEmbeddedDocuments('ActiveEffect', [{
            name: 'Fleeing',
            img: FLEEING_IMG,
            statuses: [STATUS_ID],
            // v14 only paints a token icon for showIcon ALWAYS, or CONDITIONAL
            // with a duration. This effect has no duration, so force ALWAYS.
            showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
            changes,
            flags: { ose: { fleeingAc: acDelta } },
        }]);
        reportByActorName.set(actor.name, { adding: true, ac: acDelta });
    }
}

if (reportByActorName.size > 0 || skippedTokenNames.length > 0) {
    const collatedItems = [];
    reportByActorName.forEach((result, actorName) => {
        const addingOrRemoving = result.adding ? 'Adding' : 'Removing';
        const acNote = result.ac
            ? ` (forfeits shield: AC ${result.adding ? 'penalty' : 'restored'} ${Math.abs(result.ac)})`
            : ' (no shield to forfeit)';
        collatedItems.push(`<b>${actorName}:</b>  ${addingOrRemoving} Fleeing${acNote}.<br/>`);
    });

    skippedTokenNames.forEach(name => {
        collatedItems.push(`<b>${name}:</b>  Skipped (no actor).<br/>`);
    });

    // The +2-to-hit half of the rule can't be automated; remind the DM once.
    collatedItems.push('<i>Reminder: enemies attacking a fleeing target this round get +2 to hit (apply on the attack roll).</i><br/>');

    ChatMessage.create({ content: reportContent(collatedItems.join('<br/>')) });
} else {
    ChatMessage.create({ content: reportContent('No recipients processed.') });
}
