(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const effectIcon = "icons/svg/lightning.svg";

  const applySpeedEffect = async (moveMultiplier, hours) => {
    const durationInSeconds = hours * 3600;

    const effectData = {
      name: "Speed of the Heroes",
      img: effectIcon,
      icon: effectIcon,
      duration: {
        seconds: durationInSeconds
      },
      flags: {
        ose: {
          isHasted: true,
          isSpeedOfHeroes: true,
          moveMultiplier: moveMultiplier
        }
      },
      description: `Movement rate multiplied by ${moveMultiplier}x (base & encounter). Double normal attacks per round (spells and magic devices not doubled).`,
      changes: [
        {
          key: "system.movement.base",
          mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
          value: String(moveMultiplier),
          priority: 20
        }
      ]
    };

    if (typeof macro !== "undefined" && macro?.uuid) {
      effectData.origin = macro.uuid;
    }

    for (const token of tokens) {
      if (token.actor) {
        await token.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
        ui.notifications.info(`Applied 'Speed of the Heroes' (${moveMultiplier}x Movement, 2x Attacks) to ${token.name} for ${hours} hr(s).`);
      }
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Speed of the Heroes"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="speed-move-mult">Movement Multiplier:</label>
            <input type="number" id="speed-move-mult" name="moveMultiplier" value="2" min="1" step="0.5" autofocus/>
          </div>
          <div class="form-group">
            <label for="speed-hours">Duration (Hours):</label>
            <input type="number" id="speed-hours" name="hours" value="1" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-bolt",
          label: "Apply Speed of the Heroes",
          default: true,
          callback: async (event, button, dialog) => {
            const moveMultInput = dialog.element.querySelector("#speed-move-mult");
            const hoursInput = dialog.element.querySelector("#speed-hours");
            const moveMultiplier = moveMultInput ? parseFloat(moveMultInput.value) : 2;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 1;
            await applySpeedEffect(moveMultiplier, hours);
          }
        },
        {
          action: "cancel",
          icon: "fas fa-times",
          label: "Cancel"
        }
      ]
    }).render(true);
  } else {
    new Dialog({
      title: "Apply Effect: Speed of the Heroes",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="speed-move-mult">Movement Multiplier:</label>
            <input type="number" id="speed-move-mult" name="moveMultiplier" value="2" min="1" step="0.5" autofocus/>
          </div>
          <div class="form-group">
            <label for="speed-hours">Duration (Hours):</label>
            <input type="number" id="speed-hours" name="hours" value="1" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-bolt"></i>',
          label: "Apply Speed of the Heroes",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const moveMultInput = form.querySelector("#speed-move-mult");
            const hoursInput = form.querySelector("#speed-hours");
            const moveMultiplier = moveMultInput ? parseFloat(moveMultInput.value) : 2;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 1;
            await applySpeedEffect(moveMultiplier, hours);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "apply"
    }).render(true);
  }
})();
