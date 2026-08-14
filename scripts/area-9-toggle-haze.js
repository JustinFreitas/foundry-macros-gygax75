/**
 * Area 9: Toggle Haze
 *
 * Toggles the heavy incense haze in Area 9 for controlled tokens.
 * - Applies / removes muffled torchlight (halved bright/dim radius with warm tint #e6c8a0).
 * - Applies / removes "Haze" ActiveEffect (-1 to ranged attacks due to obscured vision)
 *   with the authentic billowing smoke icon "icons/magic/air/fog-gas-smoke-dense-gray.webp".
 */
(async () => {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select at least one token first.");
    return;
  }

  const effectIcon = "icons/magic/air/fog-gas-smoke-dense-gray.webp";

  const toggleHazeForToken = async (token) => {
    const doc = token.document;
    const isHazed = doc.getFlag("world", "hazeActive");

    if (!isHazed) {
      // Save original light settings
      const origBright = doc.light.bright;
      const origDim = doc.light.dim;
      const origColor = doc.light.color;
      const origAlpha = doc.light.alpha;

      // Calculate halved/muffled light (min 5ft if originally lighting)
      const newBright = origBright > 0 ? Math.max(5, Math.floor(origBright / 2)) : 0;
      const newDim = origDim > 0 ? Math.max(10, Math.floor(origDim / 2)) : 0;

      await doc.setFlag("world", "hazeActive", true);
      await doc.setFlag("world", "origLight", {
        bright: origBright,
        dim: origDim,
        color: origColor,
        alpha: origAlpha
      });

      await doc.update({
        "light.bright": newBright,
        "light.dim": newDim,
        "light.color": "#e6c8a0",
        "light.alpha": 0.35
      });

      // Apply Haze Active Effect (-1 Ranged Attacks due to obscured vision)
      if (token.actor) {
        const existingEffect = token.actor.effects.find(e => e.name === "Haze");
        if (!existingEffect) {
          await token.actor.createEmbeddedDocuments("ActiveEffect", [{
            name: "Haze",
            img: effectIcon,
            icon: effectIcon,
            changes: [
              { key: "system.thac0.mod.ranged", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-1", priority: 20 }
            ]
          }]);
        }
      }

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ token: doc }),
        content: `<div class="ose chat-card"><header class="card-header"><h3>💨 Haze Entered</h3></header><div class="card-content"><p><strong>${token.name}</strong> enters the heavy haze in Area 9!</p><ul><li><strong>Muffled Light:</strong> Bright ${newBright}ft / Dim ${newDim}ft (Halved).</li><li><strong>Vision Penalty:</strong> Obscured past 15ft (-1 to ranged attacks).</li></ul></div></div>`
      });

      ui.notifications.info(`${token.name} entered Haze (Light: ${newBright}ft/${newDim}ft).`);
    } else {
      // Restore original light settings
      const orig = doc.getFlag("world", "origLight") || { bright: 30, dim: 60, color: null, alpha: 0.5 };
      
      await doc.update({
        "light.bright": orig.bright,
        "light.dim": orig.dim,
        "light.color": orig.color || null,
        "light.alpha": orig.alpha || 0.5
      });

      await doc.unsetFlag("world", "hazeActive");
      await doc.unsetFlag("world", "origLight");

      // Remove Active Effect if present
      if (token.actor) {
        const effect = token.actor.effects.find(e => e.name === "Haze");
        if (effect) await effect.delete();
      }

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ token: doc }),
        content: `<div class="ose chat-card"><header class="card-header"><h3>☀️ Haze Exited</h3></header><div class="card-content"><p><strong>${token.name}</strong> leaves the haze. Torchlight restored to normal (Bright ${orig.bright}ft / Dim ${orig.dim}ft).</p></div></div>`
      });

      ui.notifications.info(`${token.name} exited Haze (Torchlight restored).`);
    }
  };

  for (const token of tokens) {
    await toggleHazeForToken(token);
  }
})();
