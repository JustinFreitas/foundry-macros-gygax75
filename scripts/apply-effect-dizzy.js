(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const effectIcon = "icons/svg/daze.svg";

  const applyDizzyEffect = async (penalty, hours) => {
    const durationInSeconds = hours * 3600;
    const penaltyVal = penalty > 0 ? -penalty : penalty;

    const effectData = {
      name: "Dizzy",
      img: effectIcon,
      icon: effectIcon,
      duration: {
        seconds: durationInSeconds
      },
      changes: [
        {
          key: "system.thac0.mod.melee",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(penaltyVal),
          priority: 20
        },
        {
          key: "system.thac0.mod.missile",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(penaltyVal),
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
        ui.notifications.info(`Applied 'Dizzy' (${penaltyVal} THAC0) to ${token.name} for ${hours} hr(s).`);
      }
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Dizzy"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="dizzy-penalty">Attack Penalty:</label>
            <input type="number" id="dizzy-penalty" name="penalty" value="1" min="1" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="dizzy-hours">Duration (Hours):</label>
            <input type="number" id="dizzy-hours" name="hours" value="1" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-check",
          label: "Apply Dizzy",
          default: true,
          callback: async (event, button, dialog) => {
            const penaltyInput = dialog.element.querySelector("#dizzy-penalty");
            const hoursInput = dialog.element.querySelector("#dizzy-hours");
            const penalty = penaltyInput ? parseFloat(penaltyInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 1;
            await applyDizzyEffect(penalty, hours);
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
      title: "Apply Effect: Dizzy",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="dizzy-penalty">Attack Penalty:</label>
            <input type="number" id="dizzy-penalty" name="penalty" value="1" min="1" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="dizzy-hours">Duration (Hours):</label>
            <input type="number" id="dizzy-hours" name="hours" value="1" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply Dizzy",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const penaltyInput = form.querySelector("#dizzy-penalty");
            const hoursInput = form.querySelector("#dizzy-hours");
            const penalty = penaltyInput ? parseFloat(penaltyInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 1;
            await applyDizzyEffect(penalty, hours);
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
