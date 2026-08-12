// Party Order Reorient
// Allows the GM to rapidly pivot/reorient the party's marching order tokens 
// on the active scene based on a target direction (North, East, South, West).
// Tokens are placed along a trail generated using Breadth-First Search (BFS) 
// to naturally follow the dungeon's geometry back to the party's previous location.

const leaderToken = canvas.tokens.controlled[0];
const partyActors = getPartyActors();
let activePartyTokens = [];

if (partyActors.length === 0) {
    ui.notifications.warn("No characters found in the OSE Party Sheet!");
} else {
    // Find tokens on the active scene corresponding to the party, sorted by marching order
    const sceneTokens = canvas.tokens.placeables;
    activePartyTokens = partyActors.map(actor => 
        sceneTokens.find(t => t.actor?.id === actor.id)
    ).filter(t => t !== undefined);

    const rank1 = activePartyTokens[0];
    const rank2 = activePartyTokens.length > 1 ? activePartyTokens[1] : null;

    if (activePartyTokens.length === 0) {
        ui.notifications.warn("No party character tokens found on the current scene.");
    } else if (!leaderToken || (leaderToken.id !== rank1.id && (!rank2 || leaderToken.id !== rank2.id))) {
        const frontNames = rank2 ? `${rank1.name} or ${rank2.name}` : `${rank1.name}`;
        ui.notifications.warn(`Please select a front-rank token (${frontNames}) first to establish the anchor point!`);
    } else {
        const { DialogV2 } = foundry.applications.api;
        const dialog = new DialogV2({
            classes: ["ose", "dialog"],
            position: { width: 400, height: "auto" },
            window: { title: "Reorient Party" },
            content: `
                <p style='text-align:center;'>Select the <b>New Facing Direction</b> of the party.</p>
                <div class="form-group" style="display: flex; align-items: center; margin-bottom: 10px;">
                    <label style="flex: 1;">Single File Formation</label>
                    <input type="checkbox" name="singleFile" style="flex: 0 0 20px;">
                </div>
            `,
            buttons: [
                { action: "north", label: "North", default: true, callback: (e, b, d) => reorient('North', $(d.element).find('[name="singleFile"]')[0].checked) },
                { action: "east",  label: "East",  callback: (e, b, d) => reorient('East',  $(d.element).find('[name="singleFile"]')[0].checked) },
                { action: "south", label: "South", callback: (e, b, d) => reorient('South', $(d.element).find('[name="singleFile"]')[0].checked) },
                { action: "west",  label: "West",  callback: (e, b, d) => reorient('West',  $(d.element).find('[name="singleFile"]')[0].checked) }
            ]
        });
        dialog.render(true);
    }
}

function getPartyActors() {
    return game.actors
        .filter(actor => actor.type === 'character' && actor.flags.ose?.party === true)
        .sort((a, b) => {
            const orderDiff = (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999);
            return orderDiff !== 0 ? orderDiff : a.id.localeCompare(b.id);
        });
}

async function reorient(targetDir, isSingleFile) {
    const leaderToken = canvas.tokens.controlled[0];
    
    // Whichever front-rank token they selected becomes the anchor, everyone else follows in relative order.
    const sortedTokens = activePartyTokens.filter(t => t.id !== leaderToken.id);
    sortedTokens.unshift(leaderToken);

    const followers = sortedTokens.slice(1);
    
    if (followers.length === 0) {
        ui.notifications.info("No followers to reorient.");
        return;
    }

    const gridScale = canvas.grid.size;
    
    const startGX = Math.round(leaderToken.document.x / gridScale);
    const startGY = Math.round(leaderToken.document.y / gridScale);
    
    const followerCoords = followers.map(t => ({
        id: t.id,
        name: t.name,
        x: Math.round(t.document.x / gridScale),
        y: Math.round(t.document.y / gridScale)
    }));

    const cellCenter = (gx, gy) => ({ x: gx * gridScale + gridScale / 2, y: gy * gridScale + gridScale / 2 });
    const wallFree = (from, to) => !CONFIG.Canvas.polygonBackends.move.testCollision(cellCenter(from.x, from.y), cellCenter(to.x, to.y), { type: "move", mode: "any" });

    const getAdjacentOpen = (cell) => {
        const cands = [
            { x: cell.x, y: cell.y - 1 }, // N
            { x: cell.x, y: cell.y + 1 }, // S
            { x: cell.x + 1, y: cell.y }, // E
            { x: cell.x - 1, y: cell.y }  // W
        ];
        return cands.filter(cand => wallFree(cell, cand));
    };

    // 1. Run BFS to find the shortest path from leader to ANY follower
    const followerSet = new Set(followerCoords.map(f => `${f.x},${f.y}`));
    const queue = [ { x: startGX, y: startGY, path: [], dir: null } ];
    const visited = new Set([`${startGX},${startGY}`]);
    let bestPath = null;
    let finalDir = null;

    // Default direction if no path found (fallback to standard backward)
    if (targetDir === 'North') finalDir = {x:0, y:1};
    else if (targetDir === 'South') finalDir = {x:0, y:-1};
    else if (targetDir === 'East') finalDir = {x:-1, y:0};
    else if (targetDir === 'West') finalDir = {x:1, y:0};

    if (followerSet.size > 0) {
        // Max iterations to prevent infinite loops in weird topologies
        let iterations = 0;
        while (queue.length > 0 && iterations < 1000) {
            iterations++;
            const curr = queue.shift();
            
            if (followerSet.has(`${curr.x},${curr.y}`) && curr.path.length > 0) {
                bestPath = curr.path;
                finalDir = curr.dir;
                break;
            }

            for (const cand of getAdjacentOpen(curr)) {
                if (!visited.has(`${cand.x},${cand.y}`)) {
                    visited.add(`${cand.x},${cand.y}`);
                    const dx = cand.x - curr.x;
                    const dy = cand.y - curr.y;
                    queue.push({
                        x: cand.x,
                        y: cand.y,
                        path: [...curr.path, cand],
                        dir: {x: dx, y: dy}
                    });
                }
            }
        }
    }

    // 2. Build the trail
    const occupied = new Set([`${startGX},${startGY}`]);
    const ordered = [{x: startGX, y: startGY}];
    let rank = [ordered[0]];

    const place = (x, y) => {
        occupied.add(`${x},${y}`);
        ordered.push({ x, y });
    };

    let rankCells = [];
    if (bestPath) {
        rankCells = [...bestPath];
    }

    // 3. Extend the trail if we need more cells than the path provided
    let lastCell = rankCells.length > 0 ? rankCells[rankCells.length - 1] : {x: startGX, y: startGY};
    let currentDir = finalDir;

    while (rankCells.length < followerCoords.length) {
        let cand = { x: lastCell.x + currentDir.x, y: lastCell.y + currentDir.y };
        
        if (!wallFree(lastCell, cand)) {
            const open = getAdjacentOpen(lastCell).filter(c => 
                !rankCells.some(rc => rc.x === c.x && rc.y === c.y) &&
                !(c.x === startGX && c.y === startGY)
            );
            if (open.length > 0) {
                cand = open[0]; 
                currentDir = { x: Math.sign(cand.x - lastCell.x), y: Math.sign(cand.y - lastCell.y) };
            } else {
                break; // Boxed in
            }
        }
        
        rankCells.push(cand);
        lastCell = cand;
    }

    // 4. Place ranks
    let prevCell = {x: startGX, y: startGY};
    for (const cell of rankCells) {
        if (ordered.length > followerCoords.length) break;

        // Determine heading to get into this cell
        let headingX = cell.x - prevCell.x;
        let headingY = cell.y - prevCell.y;
        if (headingX === 0 && headingY === 0) { headingX = finalDir.x; headingY = finalDir.y; }

        // Double File logic
        if (!isSingleFile && rank.length === 1) {
            const head = rank[0];
            // Partner is 90 deg CW of heading
            const px = head.x + headingY;
            const py = head.y - headingX;
            if (!occupied.has(`${px},${py}`) && wallFree(head, {x:px, y:py})) {
                place(px, py);
                rank.push({x: px, y: py});
                if (ordered.length > followerCoords.length) break;
            }
        }

        place(cell.x, cell.y);
        rank = [{x: cell.x, y: cell.y}];
        prevCell = cell;
    }

    // 5. Apply Updates
    const updates = [];
    for (let i = 0; i < followerCoords.length; i++) {
        if (i + 1 < ordered.length) { 
            updates.push({ 
                _id: followerCoords[i].id, 
                x: ordered[i+1].x * gridScale, 
                y: ordered[i+1].y * gridScale 
            });
        }
    }

    if (updates.length > 0) {
        await canvas.scene.updateEmbeddedDocuments("Token", updates);
    }

    const shortfall = followerCoords.length - updates.length;
    if (shortfall > 0) {
        ui.notifications.warn(`Reoriented ${updates.length} party characters; ${shortfall} could not fit in the reachable area.`);
    } else {
        ui.notifications.info(`Reoriented ${updates.length} party characters.`);
    }
}
