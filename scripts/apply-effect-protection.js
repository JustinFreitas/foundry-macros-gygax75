(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const effectIcon = "icons/svg/shield.svg";

  const applyProtectionEffect = async (acBonus, hours) => {
    const durationInSeconds = hours * 3600;

    const effectData = {
      name: "Protection of the Heroes",
      img: effectIcon,
      icon: effectIcon,
      duration: {
        seconds: durationInSeconds
      },
      changes: [
        {
          key: "system.aac.mod",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(acBonus),
          priority: 20
        },
        {
          key: "system.ac.mod",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(-acBonus),
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
        ui.notifications.info(`Applied 'Protection of the Heroes' (+${acBonus} AC) to ${token.name} for ${hours} hr(s).`);
      }
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Protection of the Heroes"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="protection-bonus">AC Bonus:</label>
            <input type="number" id="protection-bonus" name="bonus" value="1" min="1" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="protection-hours">Duration (Hours):</label>
            <input type="number" id="protection-hours" name="hours" value="4" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-shield-alt",
          label: "Apply Protection",
          default: true,
          callback: async (event, button, dialog) => {
            const bonusInput = dialog.element.querySelector("#protection-bonus");
            const hoursInput = dialog.element.querySelector("#protection-hours");
            const acBonus = bonusInput ? parseFloat(bonusInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 4;
            await applyProtectionEffect(acBonus, hours);
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
      title: "Apply Effect: Protection of the Heroes",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="protection-bonus">AC Bonus:</label>
            <input type="number" id="protection-bonus" name="bonus" value="1" min="1" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="protection-hours">Duration (Hours):</label>
            <input type="number" id="protection-hours" name="hours" value="4" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-shield-alt"></i>',
          label: "Apply Protection",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const bonusInput = form.querySelector("#protection-bonus");
            const hoursInput = form.querySelector("#protection-hours");
            const acBonus = bonusInput ? parseFloat(bonusInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 4;
            await applyProtectionEffect(acBonus, hours);
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
