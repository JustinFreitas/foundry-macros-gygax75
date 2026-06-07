// Set Marching Order
// Provides a UI to set the numeric deployment order for characters in the party.

const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

if (partyActors.length === 0) {
    ui.notifications.warn("There are no characters currently in your OSE Party Sheet!");
} else {
    // Sort by current marching order for the list display
    const sortedActors = [...partyActors].sort((a, b) => {
        const orderA = a.flags.ose?.marchingOrder ?? 999;
        const orderB = b.flags.ose?.marchingOrder ?? 999;
        return orderA - orderB;
    });

    let content = `
    <style>
        .marching-order-row { display: flex; align-items: center; margin-bottom: 5px; }
        .marching-order-row label { flex: 1; }
        .marching-order-row input { width: 50px; text-align: center; }
    </style>
    <p>Set the deployment order (1 = first, 2 = second, etc.)</p>
    <div class="marching-order-list">
    `;

    for (const actor of sortedActors) {
        const currentOrder = actor.flags.ose?.marchingOrder ?? "";
        content += `
        <div class="marching-order-row">
            <label>${actor.name}</label>
            <input type="number" name="${actor.id}" value="${currentOrder}" placeholder="999">
        </div>
        `;
    }

    content += `</div>`;

    new Dialog({
        title: "Set Marching Order",
        content: content,
        buttons: {
            save: {
                icon: '<i class="fas fa-save"></i>',
                label: "Save Order",
                callback: async (html) => {
                    const inputs = html.find('input[type="number"]');
                    for (const input of inputs) {
                        const actorId = input.name;
                        const order = input.value === "" ? 999 : parseInt(input.value);
                        const actor = game.actors.get(actorId);
                        if (actor) {
                            await actor.setFlag("ose", "marchingOrder", order);
                        }
                    }
                    ui.notifications.info("Marching order saved.");
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "save"
    }).render(true);
}
