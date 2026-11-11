// Toggle a "Bless" Active Effect on Bless recipients.
//
// Two input modes, chosen by how many tokens are selected:
//   * Legacy (2+ selected): bless the whole selection. Every selected monster
//     with a numeric morale also gets +1 morale (treated as an allied group).
//   * Caster mode (exactly 1 selected): the selected token is the caster;
//     recipients are the caster plus all TARGETED tokens. A targeted monster
//     gets +1 morale only if its token disposition matches the caster's, so
//     this works for enemy casters too (a hostile caster buffs hostile allies).
//
// Attack/damage and loyalty ride on the Active Effect (typed fields, so an "add"
// effect applies cleanly). Morale does NOT: system.details.morale lives under an
// untyped ObjectField and stores a string (e.g. "10"), so an "add" effect would
// string-concatenate ("10" -> "101"). Instead we coerce->add/sub->write back as
// a string here, guarded by the Bless toggle (matching the exhaustion macros).

// Rather than editing every weapon's system.bonus, the +1 atk/dmg drive through
// OSE actor-level modifiers read directly by rollAttack / rollDamage:
//   * system.thac0.mod.melee    -> melee attack
//   * system.thac0.mod.missile  -> missile attack
//   * system.damage.mod.melee   -> melee damage
//   * system.damage.mod.missile -> missile damage
const blessChanges = [
    { key: 'system.thac0.mod.melee', type: 'add', value: 1 },
    { key: 'system.thac0.mod.missile', type: 'add', value: 1 },
    { key: 'system.damage.mod.melee', type: 'add', value: 1 },
    { key: 'system.damage.mod.missile', type: 'add', value: 1 },
];

// Collapsed usage help, prepended to every report so players can discover the
// modes (including enemy-caster behavior) without cluttering each message.
// Mirrors the <details>/<summary> pattern used by the Treasure Stow macro.
const usageHtml = `
<details>
  <summary><i>How to use Bless</i></summary>
  <ul style="margin:0.3em 0; padding-left:1.2em;">
    <li><b>Bless a group (legacy):</b> select 2+ tokens and run. All selected are blessed; every selected monster with numeric morale gets +1 morale.</li>
    <li><b>Bless as a caster:</b> select exactly <b>one</b> caster token, then <b>target</b> (T) the recipients. The caster is auto-included. A targeted monster gains +1 morale only if its token disposition matches the caster's &mdash; so this works for <b>enemy casters too</b> (a hostile caster buffs hostile allies' morale). With one token selected and <b>no</b> targets, that token is simply blessed on its own.</li>
    <li><b>Remove Bless:</b> re-run on the blessed tokens &mdash; selecting a group toggles them all off, and selecting a single already-blessed token removes it (no targeting needed). Removal reverses the morale change.</li>
  </ul>
</details>`;

const reportContent = (body) => `<h2>Toggle Bless Report</h2>${usageHtml}${body}`;

// Detect by the effect's `statuses` (a Set) or name. Avoid getFlag with a
// custom scope: Foundry validates the scope against active packages and throws
// for unregistered ones like a world id.
const findBless = (actor) => actor.effects.find(e => e.statuses?.has('bless') || e.name === 'Bless');

// Monster morale read-modify-write. Only touches monster actors whose morale is
// a clean integer; "Varies", "7(12)", blank etc. are left alone. Writes back as
// a string to match how the sheet stores the field. `delta` is +1 on apply, -1
// on remove.
const adjustMorale = async (actor, delta) => {
    if (actor.type !== 'monster') return false;
    const raw = actor.system?.details?.morale;
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || String(n) !== String(raw ?? '').trim()) return false;
    await actor.update({ 'system.details.morale': String(n + delta) });
    return true;
};

const controlled = canvas.tokens.controlled;

if (controlled.length === 0) {
    ChatMessage.create({ content: reportContent('No tokens selected.') });
    return;
}

// A single selected token that is already blessed is a toggle-OFF, not a cast,
// so it skips caster mode and just gets un-blessed by the normal loop below.
const singleAlreadyBlessed =
    controlled.length === 1 && controlled[0].actor && findBless(controlled[0].actor);

// Caster mode only engages for a single UNblessed token that also has targets.
// A single token with no targets falls back to legacy (just bless that token),
// with a tip explaining how to cast on allies next time.
const targets = [...(game.user?.targets ?? [])];
const casterMode = controlled.length === 1 && !singleAlreadyBlessed && targets.length > 0;
const caster = casterMode ? controlled[0] : null;
const singleNoTargetFallback = controlled.length === 1 && !singleAlreadyBlessed && targets.length === 0;

// Build the recipient token set.
let recipientTokens;
if (casterMode) {
    recipientTokens = [...new Set([caster, ...targets])]; // caster auto-included
} else {
    recipientTokens = controlled; // legacy group, the single already-blessed token, or single no-target fallback
}

// Morale eligibility differs by mode. In caster mode, only allies (same token
// disposition as the caster) are loyal enough to gain morale; in legacy mode the
// whole selection is treated as allied.
const moraleEligible = (token) => {
    if (token.actor?.type !== 'monster') return false;
    if (!casterMode) return true;
    return token.document.disposition === caster.document.disposition;
};

const reportByActorName = new Map();
const skippedTokenNames = [];

for (const token of recipientTokens) {
    const actor = token.actor;
    if (!actor) {
        skippedTokenNames.push(token.name ?? 'Unknown token');
        continue;
    }

    const existing = findBless(actor);
    if (existing) {
        // Reverse morale only if THIS effect actually applied it (flagged at add
        // time), so removal exactly undoes the apply regardless of mode or any
        // disposition change since.
        const hadMorale = existing.flags?.ose?.blessMorale === true;
        // Report loyalty from what the effect actually carried (its changes), not
        // the actor's current retainer.enabled, which may have changed since.
        const existingChanges = existing.system?.changes ?? existing.changes ?? [];
        const hadLoyalty = existingChanges.some(c => c.key === 'system.retainer.loyalty');
        await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
        const morale = hadMorale ? await adjustMorale(actor, -1) : false;
        reportByActorName.set(actor.name, { adding: false, morale, loyalty: hadLoyalty });
    } else {
        const changes = [...blessChanges];
        // Retainer NPCs roll loyalty (system.retainer.loyalty) instead of morale; give
        // them the equivalent +1. Gated by retainer.enabled so it stays inert for
        // non-retainer actors. Loyalty is a typed NumberField, so the AE applies cleanly.
        const blessesLoyalty = actor.system?.retainer?.enabled === true;
        if (blessesLoyalty) {
            changes.push({ key: 'system.retainer.loyalty', type: 'add', value: 1 });
        }
        // Apply morale first so the effect can record whether it actually changed
        // (adjustMorale no-ops on non-numeric/non-monster). The flag drives an exact
        // reversal on removal, independent of mode or later disposition changes.
        const morale = moraleEligible(token) ? await adjustMorale(actor, +1) : false;
        await actor.createEmbeddedDocuments('ActiveEffect', [{
            name: 'Bless',
            img: 'icons/magic/life/ankh-gold-blue.webp',
            statuses: ['bless'],
            // Foundry v14 only draws a token icon when showIcon is ALWAYS, or
            // CONDITIONAL with a duration. This effect has no duration, so we
            // must force ALWAYS or no icon appears.
            showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON?.ALWAYS ?? 2,
            system: { changes },
            flags: { ose: { blessMorale: morale } },
        }]);
        reportByActorName.set(actor.name, { adding: true, loyalty: blessesLoyalty, morale });
    }
}

if (reportByActorName.size > 0 || skippedTokenNames.length > 0) {
    const collatedItems = [];
    reportByActorName.forEach((result, actorName) => {
        const addingOrRemoving = result.adding ? 'Adding' : 'Removing';
        const parts = ['+1 attack/damage'];
        if (result.morale) parts.push('+1 morale');
        if (result.loyalty) parts.push('+1 loyalty');
        collatedItems.push(`<b>${actorName}:</b>  ${addingOrRemoving} Bless (${parts.join(', ')}).<br/>`);
    });

    skippedTokenNames.forEach(name => {
        collatedItems.push(`<b>${name}:</b>  Skipped (no actor).<br/>`);
    });

    // One token, no targets: blessed it directly. Hint at caster mode for next time.
    if (singleNoTargetFallback) {
        collatedItems.push('<i>Tip: TARGET (T) one or more tokens before running to cast on allies (caster mode), where monster morale follows the caster\'s disposition.</i><br/>');
    }

    ChatMessage.create({ content: reportContent(collatedItems.join('<br/>')) });
} else {
    ChatMessage.create({ content: reportContent('No recipients processed.') });
}
