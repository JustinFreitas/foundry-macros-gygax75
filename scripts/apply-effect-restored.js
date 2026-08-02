(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const applyRestoredEffect = async (healAmount) => {
    const collatedReports = [];

    for (const token of tokens) {
      const actor = token.actor;
      if (actor) {
        const preventsHealing = actor.effects?.some(
          (e) => e.flags?.ose?.preventsHealing || e.name?.includes("Poison") || e.name?.includes("Diseased")
        );

        if (preventsHealing) {
          collatedReports.push(`<b>${actor.name}:</b> Cannot be healed (Poisoned / Diseased).`);
          ui.notifications.warn(`${actor.name} cannot be healed (Poisoned / Diseased).`);
          continue;
        }

        const currentHp = actor.system.hp?.value ?? 0;
        const maxHp = actor.system.hp?.max ?? currentHp;
        const newHp = Math.min(maxHp, currentHp + healAmount);
        const actualHealed = newHp - currentHp;

        await actor.update({ "system.hp.value": newHp });
        collatedReports.push(`<b>${actor.name}:</b> Healed ${actualHealed} HP (now ${newHp}/${maxHp})`);
        ui.notifications.info(`Healed ${actor.name} for ${actualHealed} HP.`);
      }
    }

    if (collatedReports.length > 0) {
      ChatMessage.create({
        content: `<h2>Restored by the Heroes</h2>${collatedReports.join("<br/>")}`
      });
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Apply Effect: Restored by the Heroes"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="heal-amount">HP Restored:</label>
            <input type="number" id="heal-amount" name="healAmount" value="6" min="1" step="1" autofocus/>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "apply",
          icon: "fas fa-heart",
          label: "Heal",
          default: true,
          callback: async (event, button, dialog) => {
            const healInput = dialog.element.querySelector("#heal-amount");
            const healAmount = healInput ? parseInt(healInput.value, 10) : 6;
            await applyRestoredEffect(healAmount);
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
      title: "Apply Effect: Restored by the Heroes",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label for="heal-amount">HP Restored:</label>
            <input type="number" id="heal-amount" name="healAmount" value="6" min="1" step="1" autofocus/>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-heart"></i>',
          label: "Heal",
          callback: async (html) => {
            const form = html[0]?.querySelector ? html[0] : html;
            const healInput = form.querySelector("#heal-amount");
            const healAmount = healInput ? parseInt(healInput.value, 10) : 6;
            await applyRestoredEffect(healAmount);
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
