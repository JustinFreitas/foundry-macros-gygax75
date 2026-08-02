(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const effectIcon = "icons/svg/sun.svg";

  const applyBlessedEffect = async (attackBonus, damageBonus, moraleBonus, hours) => {
    const durationInSeconds = hours * 3600;

    const changes = [
      {
        key: "system.thac0.mod.melee",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(attackBonus),
        priority: 20
      },
      {
        key: "system.thac0.mod.missile",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(attackBonus),
        priority: 20
      },
      {
        key: "system.damage.mod.melee",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(damageBonus),
        priority: 20
      },
      {
        key: "system.damage.mod.missile",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(damageBonus),
        priority: 20
      },
      {
        key: "system.details.morale",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(moraleBonus),
        priority: 20
      }
    ];

    const effectData = {
      name: "Blessed",
      img: effectIcon,
      icon: effectIcon,
      duration: {
        seconds: durationInSeconds
      },
      description: `Grants +${attackBonus} Attack, +${damageBonus} Damage, and +${moraleBonus} Morale.`,
      changes: changes
    };

    if (typeof macro !== "undefined" && macro?.uuid) {
      effectData.origin = macro.uuid;
    }

    for (const token of tokens) {
      if (token.actor) {
        await token.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
        ui.notifications.info(`Applied 'Blessed' (+${attackBonus} Atk, +${damageBonus} Dmg, +${moraleBonus} Morale) to ${token.name} for ${hours} hr(s).`);
      }
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Blessed"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="blessed-attack">Attack Bonus:</label>
            <input type="number" id="blessed-attack" name="attack" value="1" min="0" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="blessed-damage">Damage Bonus:</label>
            <input type="number" id="blessed-damage" name="damage" value="1" min="0" step="1"/>
          </div>
          <div class="form-group">
            <label for="blessed-morale">Morale Bonus:</label>
            <input type="number" id="blessed-morale" name="morale" value="1" min="0" step="1"/>
          </div>
          <div class="form-group">
            <label for="blessed-hours">Duration (Hours):</label>
            <input type="number" id="blessed-hours" name="hours" value="1" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-check",
          label: "Apply Bless",
          default: true,
          callback: async (event, button, dialog) => {
            const attackInput = dialog.element.querySelector("#blessed-attack");
            const damageInput = dialog.element.querySelector("#blessed-damage");
            const moraleInput = dialog.element.querySelector("#blessed-morale");
            const hoursInput = dialog.element.querySelector("#blessed-hours");

            const attackBonus = attackInput ? parseFloat(attackInput.value) : 1;
            const damageBonus = damageInput ? parseFloat(damageInput.value) : 1;
            const moraleBonus = moraleInput ? parseFloat(moraleInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 1;

            await applyBlessedEffect(attackBonus, damageBonus, moraleBonus, hours);
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
      title: "Apply Effect: Blessed",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="blessed-attack">Attack Bonus:</label>
            <input type="number" id="blessed-attack" name="attack" value="1" min="0" step="1" autofocus/>
          </div>
          <div class="form-group">
            <label for="blessed-damage">Damage Bonus:</label>
            <input type="number" id="blessed-damage" name="damage" value="1" min="0" step="1"/>
          </div>
          <div class="form-group">
            <label for="blessed-morale">Morale Bonus:</label>
            <input type="number" id="blessed-morale" name="morale" value="1" min="0" step="1"/>
          </div>
          <div class="form-group">
            <label for="blessed-hours">Duration (Hours):</label>
            <input type="number" id="blessed-hours" name="hours" value="1" min="1" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply Bless",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const attackInput = form.querySelector("#blessed-attack");
            const damageInput = form.querySelector("#blessed-damage");
            const moraleInput = form.querySelector("#blessed-morale");
            const hoursInput = form.querySelector("#blessed-hours");

            const attackBonus = attackInput ? parseFloat(attackInput.value) : 1;
            const damageBonus = damageInput ? parseFloat(damageInput.value) : 1;
            const moraleBonus = moraleInput ? parseFloat(moraleInput.value) : 1;
            const hours = hoursInput ? parseFloat(hoursInput.value) : 1;

            await applyBlessedEffect(attackBonus, damageBonus, moraleBonus, hours);
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
