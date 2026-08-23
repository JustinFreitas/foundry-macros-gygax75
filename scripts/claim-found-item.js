(async () => {
    // 1. Determine active actor from controlled token or fall back to assigned character
    const actor = canvas?.tokens?.controlled?.[0]?.actor || game?.user?.character;
    if (!actor) {
        ui.notifications.info("No character token selected.");
        return;
    }

    // 2. Filter actor's items for (Found) items
    const foundItems = (actor.items ? Array.from(actor.items) : []).filter(item => item.name?.includes("(Found)"));

    // 3. Inform if no (Found) items are on the actor
    if (foundItems.length === 0) {
        ui.notifications.info(`${actor.name} has no (Found) items to claim.`);
        return;
    }

    // 4. Build content listing all (Found) items with checkboxes, icons, clean names, and quantities
    const rowsHtml = foundItems.map(item => {
        const cleanName = item.name.replace(/\s*\(Found\)$/i, "").trim();
        const qty = item.system?.quantity?.value ?? item.system?.quantity ?? 1;
        const qtyText = qty > 1 ? ` (Qty: ${qty})` : "";
        const imgSrc = item.img || "icons/svg/item-bag.svg";
        return `
            <div class="form-group" style="display: flex; align-items: center; margin-bottom: 6px; gap: 8px;">
                <input type="checkbox" id="claim-item-${item.id}" name="claim-item" value="${item.id}" checked />
                <img src="${imgSrc}" alt="${cleanName}" width="24" height="24" style="border: 0; flex-shrink: 0;" />
                <label for="claim-item-${item.id}" style="flex-grow: 1; cursor: pointer;">${cleanName}${qtyText}</label>
            </div>
        `;
    }).join("");

    const content = `
        <form class="flexcol claim-found-items-form">
            <p>Select (Found) items for <b>${actor.name}</b> to claim as personal equipment:</p>
            <div class="item-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;">
                ${rowsHtml}
            </div>
        </form>
    `;

    const DialogV2 = foundry.applications?.api?.DialogV2 ?? Dialog;
    const dialog = new DialogV2({
        classes: ["ose", "dialog"],
        position: { width: 450, height: "auto" },
        window: { title: `Claim Found Items - ${actor.name}` },
        content: content,
        buttons: [
            {
                action: "claim",
                label: "Claim as Personal Gear",
                default: true,
                callback: async (event, button, dialog) => {
                    const element = dialog.element instanceof HTMLElement ? dialog.element : (dialog.element?.[0] || dialog.element);
                    const checkedBoxes = Array.from(element?.querySelectorAll('input[name="claim-item"]:checked') || []);
                    const selectedIds = new Set(checkedBoxes.map(cb => cb.value));
                    const itemsToClaim = foundItems.filter(item => selectedIds.has(item.id));

                    if (itemsToClaim.length === 0) {
                        ui.notifications.info("No items selected to claim.");
                        return;
                    }

                    const claimedNames = [];
                    for (const item of itemsToClaim) {
                        const cleanName = item.name.replace(/\s*\(Found\)$/i, "").trim();
                        await item.update({ name: cleanName });
                        claimedNames.push(cleanName);
                    }

                    if (claimedNames.length > 0) {
                        await ChatMessage.create({
                            content: `<h3>Item Claimed</h3><p><b>${actor.name}</b> has claimed <b>${claimedNames.join(", ")}</b> as personal equipment.</p>`
                        });
                    }
                }
            },
            {
                action: "cancel",
                label: "Cancel"
            }
        ]
    });

    dialog.render(true);
})();
