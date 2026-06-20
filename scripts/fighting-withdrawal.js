const statusEffectName = 'Fighting Withdrawal'; // Input name

const selectedTokens = canvas.tokens.controlled;
if (selectedTokens.length === 0) {
  return ui.notifications.warn("Select one or more tokens first.");
}

// Search CONFIG.statusEffects by label (not name)
const statusEffectID = CONFIG.statusEffects.find((el) =>
  (el.label || el.name)?.toLowerCase().includes(statusEffectName.toLowerCase())
)?.id || statusEffectName;

// Apply to all selected tokens
for (const token of selectedTokens) {
  const actor = token.actor;
  if (!actor) continue;
  await actor.toggleStatusEffect(statusEffectID);
}
