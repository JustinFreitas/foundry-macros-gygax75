// Party Sheet Deploy V18 (Cardinal Greedy Snake Formation)
// Places tokens one-by-one, strictly adjacent, following a cardinal preference [Opposite, CW, CW, CW].
// Prefers legal spots (backtracking allowed), but breaks walls from the tail if no legal spots exist.

const leaderToken = canvas.tokens.controlled[0];

if (!leaderToken) {
    ui.notifications.warn("Please select the Party Token first!");
} else {
    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

    if (partyActors.length === 0) {
        ui.notifications.warn("No characters found in the OSE Party Sheet!");
    } else {
        partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

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
}

async function deploy(dirX, dirY, isSingleFile) {
    const leaderToken = canvas.tokens.controlled[0];
    const { x: sX, y: sY, width: lW, height: lH } = leaderToken.document;
    const gridScale = canvas.grid.size;
    const lCenter = leaderToken.center;
    const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(lCenter));

    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);
    partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

    const finalSpots = [];
    const usedKeys = new Set();
    
    // Define the Cardinal Search Sequence: [Opposite, CW, CW, CW]
    const oppX = -dirX; const oppY = -dirY;
    const searchSequence = [
        { x: oppX, y: oppY },          // 1. Opposite of Facing
        { x: -oppY, y: oppX },         // 2. CW from 1
        { x: -oppX, y: -oppY },        // 3. CW from 2
        { x: oppY, y: -oppX }          // 4. CW from 3
    ];

    // PASS 1: Initialize Footprint
    // We fill the footprint squares first using the greedy logic from the start point
    let tail = { x: sX, y: sY };
    usedKeys.add(`${tail.x},${tail.y}`);
    finalSpots.push(tail);

    for (let i = 1; i < partyActors.length; i++) {
        let bestSpot = null;

        // --- STEP A: TACTICAL LEGAL SEARCH (Backtracking Allowed) ---
        // Search through ALL placed spots (starting from tail) to find a legal adjacent square
        for (let j = finalSpots.length - 1; j >= 0 && !bestSpot; j--) {
            const parent = finalSpots[j];
            for (const dir of searchSequence) {
                const nx = parent.x + dir.x * gridScale;
                const ny = parent.y + dir.y * gridScale;
                const key = `${nx},${ny}`;
                if (usedKeys.has(key)) continue;

                // Check if neighbor is within Footprint
                const isFootprint = nx >= sX && nx < sX + lW * gridScale && ny >= sY && ny < sY + lH * gridScale;
                
                // If it's a 2x2 footprint, we MUST fill it before expanding
                if (finalSpots.length < (lW * lH) && !isFootprint) continue;

                const nC = { x: nx + gridScale/2, y: ny + gridScale/2 };
                const pC = { x: parent.x + gridScale/2, y: parent.y + gridScale / 2 };
                const wall = CONFIG.Canvas.polygonBackends.move.testCollision(pC, nC, { type: "move", mode: "any" });
                const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
                
                if (!wall && reg) {
                    bestSpot = { x: nx, y: ny };
                    break;
                }
            }
        }

        // --- STEP B: GREEDY ILLEGAL FALLBACK (Disregard walls to keep line contiguous) ---
        // If NO legal spot exists adjacent to ANY token, we force a move from the absolute TAIL
        if (!bestSpot) {
            const currentTail = finalSpots[finalSpots.length - 1];
            for (const dir of searchSequence) {
                const nx = currentTail.x + dir.x * gridScale;
                const ny = currentTail.y + dir.y * gridScale;
                const key = `${nx},${ny}`;
                if (usedKeys.has(key)) continue;
                
                bestSpot = { x: nx, y: ny };
                break;
            }
        }

        // --- STEP C: EMERGENCY BACKTRACK (Tail is trapped, find first open neighbor anywhere) ---
        if (!bestSpot) {
            for (let j = finalSpots.length - 1; j >= 0 && !bestSpot; j--) {
                const parent = finalSpots[j];
                for (const dir of searchSequence) {
                    const nx = parent.x + dir.x * gridScale;
                    const ny = parent.y + dir.y * gridScale;
                    if (!usedKeys.has(`${nx},${ny}`)) {
                        bestSpot = { x: nx, y: ny };
                        break;
                    }
                }
            }
        }

        if (bestSpot) {
            finalSpots.push(bestSpot);
            usedKeys.add(`${bestSpot.x},${bestSpot.y}`);
        } else {
            break; // Absolutely no squares available
        }
    }

    // 3. Create tokens
    const toCreate = partyActors.slice(0, finalSpots.length).map((actor, i) => {
        const spot = finalSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
    ui.notifications.info(`Deployed ${toCreate.length} party characters.`);
}
