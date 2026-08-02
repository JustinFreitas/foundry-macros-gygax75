(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const effectIcon = "icons/svg/up.svg";

  const applyMightEffect = async (bonus, hours) => {
    const durationInSeconds = hours * 3600;

    const effectData = {
      name: "Might of the Heroes",
      img: effectIcon,
      icon: effectIcon,
      duration: {
        seconds: durationInSeconds
      },
      changes: [
        {
          key: "system.damage.mod.melee",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(bonus),
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
        ui.notifications.info(`Applied 'Might of the Heroes' (+${bonus} Melee Damage) to ${token.name} for ${hours} hr(s).`);
      }
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Might of the Heroes"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="might-bonus">Damage Bonus:</label>
            <input type="number" id="might-bonus" name="bonus" value="1" min="1" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="might-hours">Duration (Hours):</label>
            <input type="number" id="might-hours" name="hours" value="3" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-check",
          label: "Apply Might",
          default: true,
          callback: async (event, button, dialog) => {
            const bonusInput = dialog.element.querySelector("#might-bonus");
            const hoursInput = dialog.element.querySelector("#might-hours");
            const bonus = bonusInput ? parseFloat(bonusInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 3;
            await applyMightEffect(bonus, hours);
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
      title: "Apply Effect: Might of the Heroes",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="might-bonus">Damage Bonus:</label>
            <input type="number" id="might-bonus" name="bonus" value="1" min="1" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="might-hours">Duration (Hours):</label>
            <input type="number" id="might-hours" name="hours" value="3" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply Might",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const bonusInput = form.querySelector("#might-bonus");
            const hoursInput = form.querySelector("#might-hours");
            const bonus = bonusInput ? parseFloat(bonusInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 3;
            await applyMightEffect(bonus, hours);
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
