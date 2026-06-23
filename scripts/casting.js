// Toggle the "Casting" status on the selected tokens AND keep the OSE system's
// own casting flag in sync.
//
// Background: OSE tracks casting state in TWO places that previously did not
// talk to each other:
//   * a status effect (icon), toggled by this macro, and
//   * the combatant flag `prepareSpell` (combat/combatant.ts: isCasting getter/
//     setter -> getFlag/setFlag(system.id, 'prepareSpell')), which the combat
//     tracker reads to show its own casting indicator.
// Toggling only the status left the combat tracker's indicator stale. This macro
// now drives both from a single source of truth: the status effect's presence.
// The combatant flag is set to match. If there is no active combat (or the token
// isn't in it), the flag step is simply skipped.

const statusEffectName = 'Casting'; // Input name

const selectedTokens = canvas.tokens.controlled;
if (selectedTokens.length === 0) {
  return ui.notifications.warn("Select one or more tokens first.");
}

// Search CONFIG.statusEffects by label (not name)
const statusEffectID = CONFIG.statusEffects.find((el) =>
  (el.label || el.name)?.toLowerCase().includes(statusEffectName.toLowerCase())
)?.id || statusEffectName;

// True once an actor HAS the casting status (after toggling), so we can mirror
// it onto the combatant flag.
const hasCastingStatus = (actor) =>
  actor.statuses?.has?.(statusEffectID) ||
  actor.effects?.some?.((e) => e.statuses?.has?.(statusEffectID) || e.name === statusEffectName);

for (const token of selectedTokens) {
  const actor = token.actor;
  if (!actor) continue;

  await actor.toggleStatusEffect(statusEffectID);

  // Mirror the resulting state onto the combatant's prepareSpell flag so the
  // combat tracker's casting indicator agrees with the status icon.
  const combatant = token.combatant ?? game.combat?.getCombatantByToken?.(token.id);
  if (combatant) {
    combatant.isCasting = hasCastingStatus(actor);
  }
}
