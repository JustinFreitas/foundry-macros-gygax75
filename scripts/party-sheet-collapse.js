// Party Sheet Collapse
// Inverse of party-sheet-deploy.js: removes the individual party-character
// tokens from the scene and drops a single "Party" token in their place,
// anchored on the rank-1 (leader) character.
//
// The Party token is anchored exactly the way deploy unpacks it: its front /
// lowest-lane footprint corner sits on the leader's cell. For a 1x1 (5') token
// that is simply the leader's cell; for a 2x2 (10') token facing north that is
// the upper-left square, and the equivalent corner for the other directions.

const partyActor = game.actors.getName("Party");

if (!partyActor) {
    ui.notifications.warn('No actor named "Party" was found to create the Party token.');
} else {
    const partyActorIds = new Set(
        game.actors
            .filter(actor => actor.type === 'character' && actor.flags.ose?.party === true)
            .map(actor => actor.id)
    );

    // The deployed character tokens currently on this scene.
    const memberTokens = canvas.tokens.placeables.filter(t => partyActorIds.has(t.actor?.id));

    if (memberTokens.length === 0) {
        ui.notifications.warn("No party-character tokens were found on this scene to collapse.");
    } else {
        new Dialog({
            title: "Collapse Party",
            content: `
                <p style='text-align:center;'>Which direction is the party facing?</p>
                <div class="form-group" style="display:flex; align-items:center; margin-bottom:10px;">
                    <label style="flex:1;">Party token size</label>
                    <select name="size" style="flex:0 0 130px;">
                        <option value="1">5' square (1x1)</option>
                        <option value="2">10' square (2x2)</option>
                    </select>
                </div>
            `,
            buttons: {
                north: { label: "North", callback: (html) => collapse(0, -1, html) },
                east:  { label: "East",  callback: (html) => collapse(1, 0,  html) },
                south: { label: "South", callback: (html) => collapse(0, 1,  html) },
                west:  { label: "West",  callback: (html) => collapse(-1, 0, html) }
            },
            default: "north"
        }).render(true);

        async function collapse(dirX, dirY, html) {
            const size = parseInt(html.find('[name="size"]')[0].value) || 1;
            const gridScale = canvas.grid.size;

            // Rank-1 character = lowest marching order (ties broken by id), to
            // match how deploy orders and anchors the party.
            const leaderActorId = [...partyActorIds]
                .map(id => game.actors.get(id))
                .filter(Boolean)
                .sort((a, b) => {
                    const diff = (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999);
                    return diff !== 0 ? diff : a.id.localeCompare(b.id);
                })[0]?.id;

            const leaderToken = memberTokens.find(t => t.actor?.id === leaderActorId) || memberTokens[0];

            // Leader's grid cell.
            const lgx = Math.round(leaderToken.document.x / gridScale);
            const lgy = Math.round(leaderToken.document.y / gridScale);

            // Find the size×size footprint's anchor corner using the SAME rule as
            // party-sheet-deploy.js (frontmost in travel, then lowest lane), then
            // shift the token's top-left so that corner lands on the leader's cell.
            // This guarantees collapse exactly inverts deploy for every direction
            // and token size. Offsets are measured from the top-left cell (w, h).
            const back = { x: -dirX, y: -dirY };
            const side = { x: -dirY, y: dirX };          // 90° CW of facing
            const rankOf = (w, h) => w * back.x + h * back.y;
            const laneOf = (w, h) => w * side.x + h * side.y;

            let aW = 0, aH = 0;
            for (let w = 0; w < size; w++) {
                for (let h = 0; h < size; h++) {
                    const dRank = rankOf(w, h) - rankOf(aW, aH);
                    const dLane = laneOf(w, h) - laneOf(aW, aH);
                    if (dRank < -0.1 || (Math.abs(dRank) < 0.1 && dLane < -0.1)) { aW = w; aH = h; }
                }
            }
            // top-left = leader - anchorOffset (so footprint cell (aW,aH) == leader)
            const tlGX = lgx - aW;
            const tlGY = lgy - aH;

            const data = partyActor.prototypeToken.toObject();
            data.x = tlGX * gridScale;
            data.y = tlGY * gridScale;
            data.width = size;
            data.height = size;
            data.actorId = partyActor.id;
            data.hidden = false;

            await canvas.scene.createEmbeddedDocuments("Token", [data]);
            await canvas.scene.deleteEmbeddedDocuments("Token", memberTokens.map(t => t.id));

            ui.notifications.info(`Collapsed ${memberTokens.length} party tokens into the Party token.`);
        }
    }
}
