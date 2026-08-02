(async () => {
  // Ensure a token is selected
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Please select a token first.");
    return;
  }

  const curePoisonEffect = async () => {
    const collatedReports = [];

    for (const token of tokens) {
      const actor = token.actor;
      if (actor) {
        const effectsToCure = actor.effects.filter(
          (e) => e.flags?.ose?.preventsHealing || e.name?.includes("Poison") || e.name?.includes("Diseased")
        );

        if (effectsToCure.length > 0) {
          const idsToDelete = effectsToCure.map((e) => e.id);
          await actor.deleteEmbeddedDocuments("ActiveEffect", idsToDelete);

          const curedNames = effectsToCure.map((e) => e.name).join(", ");
          collatedReports.push(`<b>${actor.name}:</b> Cured of [${curedNames}].`);
          ui.notifications.info(`Cured Poison/Disease on ${actor.name}.`);
        } else {
          collatedReports.push(`<b>${actor.name}:</b> No poison or disease effects found.`);
        }
      }
    }

    if (collatedReports.length > 0) {
      ChatMessage.create({
        content: `<h2>Cure Poison & Disease</h2>${collatedReports.join("<br/>")}`
      });
    }
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2) {
    new DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: "Cure Poison & Disease"
      },
      content: `
        <form class="flexcol">
          <p>Cure Poison and Disease active effects on all selected tokens?</p>
        </form>
      `,
      buttons: [
        {
          action: "cure",
          icon: "fas fa-magic",
          label: "Cure Selected",
          default: true,
          callback: async () => {
            await curePoisonEffect();
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
      title: "Cure Poison & Disease",
      content: `
        <form class="flexcol">
          <p>Cure Poison and Disease active effects on all selected tokens?</p>
        </form>
      `,
      buttons: {
        cure: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Cure Selected",
          callback: async () => {
            await curePoisonEffect();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "cure"
    }).render(true);
  }
})();
