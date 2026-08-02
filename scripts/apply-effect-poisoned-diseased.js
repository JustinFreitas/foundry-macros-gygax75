(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const effectIcon = "icons/svg/poison.svg";

  const applyPoisonEffect = async (damageAmount) => {
    const collatedReports = [];

    const effectData = {
      name: "Poisoned / Diseased",
      img: effectIcon,
      icon: effectIcon,
      flags: {
        ose: {
          preventsHealing: true
        }
      },
      description: "Poisoned/Diseased: cannot be healed until cured."
    };

    if (typeof macro !== "undefined" && macro?.uuid) {
      effectData.origin = macro.uuid;
    }

    for (const token of tokens) {
      const actor = token.actor;
      if (actor) {
        const currentHp = actor.system.hp?.value ?? 0;
        const newHp = Math.max(0, currentHp - damageAmount);
        const actualDamage = currentHp - newHp;

        await actor.update({ "system.hp.value": newHp });
        await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

        collatedReports.push(`<b>${actor.name}:</b> Took ${actualDamage} damage (now ${newHp}/${actor.system.hp?.max}) and is Poisoned/Diseased.`);
        ui.notifications.warn(`Applied Poison/Disease (${actualDamage} HP damage & no healing) to ${actor.name}.`);
      }
    }

    if (collatedReports.length > 0) {
      ChatMessage.create({
        content: `<h2>Poisoned & Diseased</h2>${collatedReports.join("<br/>")}`
      });
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Poisoned / Diseased"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="poison-damage">Damage Amount:</label>
            <input type="number" id="poison-damage" name="damage" value="5" min="0" step="1" autofocus/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-skull",
          label: "Apply Poison",
          default: true,
          callback: async (event, button, dialog) => {
            const damageInput = dialog.element.querySelector("#poison-damage");
            const damageAmount = damageInput ? parseInt(damageInput.value, 10) : 5;
            await applyPoisonEffect(damageAmount);
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
      title: "Apply Effect: Poisoned / Diseased",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="poison-damage">Damage Amount:</label>
            <input type="number" id="poison-damage" name="damage" value="5" min="0" step="1" autofocus/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-skull"></i>',
          label: "Apply Poison",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const damageInput = form.querySelector("#poison-damage");
            const damageAmount = damageInput ? parseInt(damageInput.value, 10) : 5;
            await applyPoisonEffect(damageAmount);
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
