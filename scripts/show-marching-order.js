// Show Marching Order
// Posts the party's single-file and double-file marching orders to chat, ranked
// by flags.ose.marchingOrder (matching how party-sheet-deploy.js deploys them).

const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

if (partyActors.length === 0) {
    ui.notifications.warn("There are no characters currently in your OSE Party Sheet!");
} else {
    // Same ordering as the deploy macro: marching order, ties broken by id so the
    // result is stable and matches what actually gets placed on the map.
    const ordered = [...partyActors].sort((a, b) => {
        const diff = (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    // Escape names before embedding them in the chat HTML.
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

    // Single file: one character per rank. The <ol> supplies the numbering, so
    // the items are just the names.
    const singleRows = ordered
        .map((actor) => `<li>${esc(actor.name)}</li>`)
        .join("");

    // N abreast per rank, each member on its own line (all labelled with the
    // rank) so long names don't wrap. A partial final rank just has fewer lines.
    const fileRows = (abreast) => {
        const rows = [];
        for (let i = 0; i < ordered.length; i++) {
            const rank = Math.floor(i / abreast) + 1;
            rows.push(`<div>Rank ${rank}: ${esc(ordered[i].name)}</div>`);
        }
        return rows.join("");
    };

    const content = `
        <h2>Marching Order</h2>
        <p><strong>Single File</strong> (front to back):</p>
        <ol style="margin-top:0;">${singleRows}</ol>
        <p><strong>Double File</strong> (front rank first):</p>
        ${fileRows(2)}
        <p><strong>Triple File</strong> (front rank first):</p>
        ${fileRows(3)}
    `;

    ChatMessage.create({ content });
}
