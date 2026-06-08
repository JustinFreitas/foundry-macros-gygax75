// Party Sheet Deploy
// Replaces the selected Party token with the adventuring party from the OSE
// Party Sheet, placed in marching order (single or double file) facing a chosen
// direction.
//
// Placement traces the party as a TRAIL OF FOOTSTEPS. The leader is frontmost
// in the chosen (travel) direction; everyone else trails backward along the
// path the column walked in on:
//   * the trail is a PATH, not a region fill — it advances from its current end
//     and never spreads sideways onto an already-occupied rank;
//   * single file is strictly one cell wide; double file places each rank two
//     abreast (rank 1 = tokens 1 & 2, rank 2 = 3 & 4, ...);
//   * it prefers to keep going straight in its current heading and only TURNS
//     when a wall/door or the region edge blocks the way, then keeps straight in
//     the new heading — so it follows a corridor around its bends;
//   * every step is checked for walls/doors (move-collision) and region
//     containment, so a token can never land across a wall;
//   * a diagonal is never stepped, so it can't cut through a wall corner.
// If the path dead-ends before everyone is placed, the rest are dropped and the
// shortfall is reported.

const leaderToken = canvas.tokens.controlled[0];

if (!leaderToken) {
    ui.notifications.warn("Please select the Party Token first!");
} else if (getPartyActors().length === 0) {
    ui.notifications.warn("No characters found in the OSE Party Sheet!");
} else {
    new Dialog({
        title: "Marching Formation",
        content: `
            <p style='text-align:center;'>Which direction is the party facing?</p>
            <div class="form-group" style="display: flex; align-items: center; margin-bottom: 10px;">
                <label style="flex: 1;">Single File Formation</label>
                <input type="checkbox" name="singleFile" style="flex: 0 0 20px;">
            </div>
        `,
        buttons: {
            north: { label: "North", callback: (html) => deploy(0, -1, html.find('[name="singleFile"]')[0].checked) },
            east:  { label: "East",  callback: (html) => deploy(1, 0,  html.find('[name="singleFile"]')[0].checked) },
            south: { label: "South", callback: (html) => deploy(0, 1,  html.find('[name="singleFile"]')[0].checked) },
            west:  { label: "West",  callback: (html) => deploy(-1, 0, html.find('[name="singleFile"]')[0].checked) }
        },
        default: "north"
    }).render(true);
}

function getPartyActors() {
    return game.actors
        .filter(actor => actor.type === 'character' && actor.flags.ose?.party === true)
        // Sort by marching order, breaking ties by id so deployments are reproducible.
        .sort((a, b) => {
            const orderDiff = (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999);
            return orderDiff !== 0 ? orderDiff : a.id.localeCompare(b.id);
        });
}

async function deploy(dirX, dirY, isSingleFile) {
    const leaderToken = canvas.tokens.controlled[0];
    const { x: sX, y: sY, width: lW, height: lH } = leaderToken.document;
    const gridScale = canvas.grid.size;
    const lCenter = leaderToken.center;
    const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(lCenter));

    const partyActors = getPartyActors();

    // Facing-axis ("forward") and lateral ("side") unit vectors. The trail
    // grows BACKWARD (opposite forward) and, in double file, one cell to the side.
    const fwd = { x: dirX, y: dirY };
    const back = { x: -dirX, y: -dirY };
    const side = { x: -dirY, y: dirX };  // 90° CW of forward

    const cellCenter = (gx, gy) => ({ x: gx * gridScale + gridScale / 2, y: gy * gridScale + gridScale / 2 });
    const inRegion = (c) => leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(c));
    const wallFree = (a, b) => !CONFIG.Canvas.polygonBackends.move.testCollision(a, b, { type: "move", mode: "any" });

    // Grid-unit coordinates of the leader's front-left footprint cell.
    const startGX = Math.round(sX / gridScale);
    const startGY = Math.round(sY / gridScale);

    // Can the trail step from an occupied cell to an empty neighbour? The step
    // must not cross a wall/door and the destination must be inside the region.
    const canStep = (fromGX, fromGY, toGX, toGY) =>
        wallFree(cellCenter(fromGX, fromGY), cellCenter(toGX, toGY)) &&
        inRegion(cellCenter(toGX, toGY));

    // Decompose a cell's offset from the leader start into rank (cells behind the
    // front; grows down the column) and lane (signed cells along the side axis).
    const rankOf = (gx, gy) => (gx - startGX) * back.x + (gy - startGY) * back.y;
    const laneOf = (gx, gy) => (gx - startGX) * side.x + (gy - startGY) * side.y;

    // The party is a trail of footsteps. The leader is frontmost in the travel
    // direction; everyone else trails BACKWARD along the path the column walked.
    // The line is a PATH, not a region fill — it advances from its current end
    // and never spreads sideways onto an already-occupied rank. In single file
    // it is strictly one cell wide; in double file each rank is two abreast.
    const occupied = new Set();
    const ordered = [];

    const place = (gx, gy) => {
        occupied.add(`${gx},${gy}`);
        ordered.push({ gx, gy });
    };

    // Seed from a single ANCHOR cell so a multi-cell party token (e.g. 2x2)
    // deploys exactly like a 1x1 dropped at the right corner. The anchor is the
    // footprint corner that is frontmost in the travel direction and on the
    // lowest lane — for north that is the top-left cell. The trail then grows
    // backward from there; the rest of the footprint is just vacated.
    let anchor = null;
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const cand = { gx: startGX + w, gy: startGY + h };
            if (anchor === null) { anchor = cand; continue; }
            const dRank = rankOf(cand.gx, cand.gy) - rankOf(anchor.gx, anchor.gy);
            const dLane = laneOf(cand.gx, cand.gy) - laneOf(anchor.gx, anchor.gy);
            // Frontmost = smallest rank; tie-break to the lowest lane.
            if (dRank < -0.1 || (Math.abs(dRank) < 0.1 && dLane < -0.1)) anchor = cand;
        }
    }
    place(anchor.gx, anchor.gy);

    // The current rank's placed cells (1 in single file, up to 2 in double) and
    // the direction the trail is currently travelling backward. The heading
    // starts on the pure "back" axis and updates whenever the path bends, so we
    // keep going straight in the NEW heading and only turn again at the next wall.
    let rank = [ordered[ordered.length - 1]];
    let heading = { x: back.x, y: back.y };

    // Step candidates from a cell, preference order: straight on the heading,
    // then either turn, then reverse (a near-impossible last resort). Diagonals
    // are excluded so the trail can't cut a wall corner.
    const stepsFor = (h) => [
        { x: h.x, y: h.y },
        { x: -h.y, y: h.x },
        { x: h.y, y: -h.x },
        { x: -h.x, y: -h.y }
    ];

    // First legal, unoccupied cell reached from `cell` in heading-preference
    // order. Returns { gx, gy, step } or null if `cell` is boxed in.
    const stepFrom = (cell, h) => {
        for (const step of stepsFor(h)) {
            const ngx = cell.gx + step.x;
            const ngy = cell.gy + step.y;
            if (occupied.has(`${ngx},${ngy}`)) continue;
            if (canStep(cell.gx, cell.gy, ngx, ngy)) return { gx: ngx, gy: ngy, step };
        }
        return null;
    };

    // Grow the trail one rank at a time.
    while (ordered.length < partyActors.length) {
        // DOUBLE FILE: complete the current rank two-abreast before stepping back.
        // The partner sits perpendicular to the heading; we only ever add one, so
        // single file (skipping this) stays strictly one cell wide.
        if (!isSingleFile && rank.length === 1) {
            const head = rank[0];
            const pgx = head.gx + heading.y;       // heading rotated CW
            const pgy = head.gy + -heading.x;
            if (!occupied.has(`${pgx},${pgy}`) && canStep(head.gx, head.gy, pgx, pgy)) {
                place(pgx, pgy);
                rank.push({ gx: pgx, gy: pgy });
                if (ordered.length >= partyActors.length) break;
            }
        }

        // Step back to the next rank. Prefer continuing straight from a rank cell;
        // try each cell of the current rank so a blocked lane can route via its
        // open partner before we resort to turning.
        let next = null;
        for (const cell of rank) {
            const straight = { gx: cell.gx + heading.x, gy: cell.gy + heading.y };
            if (!occupied.has(`${straight.gx},${straight.gy}`) &&
                canStep(cell.gx, cell.gy, straight.gx, straight.gy)) {
                next = { ...straight, step: heading };
                break;
            }
        }
        // No straight step available from any rank cell -> turn, following the
        // corridor from the rank's lead cell.
        if (!next) next = stepFrom(rank[0], heading);
        if (!next) break; // dead end

        place(next.gx, next.gy);
        rank = [{ gx: next.gx, gy: next.gy }];
        heading = next.step;
    }

    const toCreate = partyActors.slice(0, ordered.length).map((actor, i) => {
        const cell = ordered[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: cell.gx * gridScale, y: cell.gy * gridScale, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    await leaderToken.document.delete();

    const shortfall = partyActors.length - toCreate.length;
    if (shortfall > 0) {
        ui.notifications.warn(`Deployed ${toCreate.length} party characters; ${shortfall} could not fit in the reachable area.`);
    } else {
        ui.notifications.info(`Deployed ${toCreate.length} party characters.`);
    }
}
