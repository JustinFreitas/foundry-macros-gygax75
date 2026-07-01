// Set Marching Order
// Drag-and-drop UI to set the party's deployment order. The list position IS the
// order (1 = first), so duplicate, missing, or invalid numbers are impossible by
// construction — Save simply writes 1..N in the displayed order.

const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

if (partyActors.length === 0) {
    ui.notifications.warn("There are no characters currently in your OSE Party Sheet!");
} else {
    // Show the list pre-sorted by the current order; unset orders fall to the end.
    const sortedActors = [...partyActors].sort((a, b) => {
        const orderA = a.flags.ose?.marchingOrder ?? 999;
        const orderB = b.flags.ose?.marchingOrder ?? 999;
        return orderA - orderB;
    });

    const rows = sortedActors.map(actor => `
        <li class="mo-row" draggable="true" data-actor-id="${actor.id}">
            <i class="fas fa-grip-vertical mo-grip"></i>
            <span class="mo-rank"></span>
            <span class="mo-name">${actor.name}</span>
        </li>
    `).join("");

    const content = `
    <style>
        .mo-list { list-style: none; margin: 0; padding: 0; }
        .mo-row {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; margin-bottom: 4px;
            border: 1px solid var(--color-border-light-tertiary, #999);
            border-radius: 4px; background: rgba(0,0,0,0.05); cursor: grab;
        }
        .mo-row.mo-dragging { opacity: 0.4; }
        .mo-row.mo-over { border-color: #ff6400; border-style: dashed; }
        .mo-grip { opacity: 0.5; }
        .mo-rank { width: 1.5em; text-align: right; font-weight: bold; }
        .mo-name { flex: 1; }
    </style>
    <p>Drag the characters into marching order (top = first to deploy).</p>
    <ol class="mo-list" id="mo-list">${rows}</ol>
    `;

    const { DialogV2 } = foundry.applications.api;
    DialogV2.wait({
        window: { title: "Set Marching Order" },
        content: content,
        buttons: [
            {
                action: "save",
                icon: '<i class="fas fa-save"></i>',
                label: "Save Order",
                default: true,
                callback: async (event, button, dialog) => {
                    const html = [dialog.element];
                    const rows = html[0].querySelectorAll(".mo-row");
                    let order = 1;
                    for (const row of rows) {
                        const actor = game.actors.get(row.dataset.actorId);
                        if (actor) await actor.setFlag("ose", "marchingOrder", order);
                        order++;
                    }
                    ui.notifications.info("Marching order saved.");
                }
            },
            {
                action: "cancel",
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        ],
        render: (event, target) => {
            const html = [target];
            const list = html[0].querySelector("#mo-list");
            if (!list) return;

            // Keep the visible 1..N rank labels in sync with the row order.
            const renumber = () => {
                list.querySelectorAll(".mo-row").forEach((row, i) => {
                    row.querySelector(".mo-rank").textContent = `${i + 1}.`;
                });
            };
            renumber();

            let dragging = null;

            list.addEventListener("dragstart", (e) => {
                dragging = e.target.closest(".mo-row");
                if (dragging) dragging.classList.add("mo-dragging");
            });

            list.addEventListener("dragend", () => {
                if (dragging) dragging.classList.remove("mo-dragging");
                list.querySelectorAll(".mo-over").forEach(r => r.classList.remove("mo-over"));
                dragging = null;
                renumber();
            });

            list.addEventListener("dragover", (e) => {
                e.preventDefault(); // allow drop
                const over = e.target.closest(".mo-row");
                if (!over || over === dragging) return;
                list.querySelectorAll(".mo-over").forEach(r => r.classList.remove("mo-over"));
                over.classList.add("mo-over");

                // Insert the dragged row before/after the hovered row depending on
                // whether the cursor is in its top or bottom half.
                const box = over.getBoundingClientRect();
                const after = e.clientY > box.top + box.height / 2;
                list.insertBefore(dragging, after ? over.nextSibling : over);
                renumber();
            });
        }
    });
}
