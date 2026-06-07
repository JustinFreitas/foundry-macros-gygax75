// Party Sheet Deploy V19 (Tactical Cardinal Snake)
// Combines 2-wide rank filling with cardinal marching preference [Opposite, CW, CW, CW].

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
    const sideX = -dirY; const sideY = dirX;
    const laneLimit = isSingleFile ? 0.1 : 1.1;

    // Search Sequence: [Opposite, CW, CW, CW]
    const searchSequence = [
        { x: -dirX, y: -dirY, weight: 1 }, // 1. Back
        { x: -dirY, y: dirX,  weight: 2 }, // 2. CW
        { x: dirX,  y: dirY,  weight: 3 }, // 3. Front
        { x: dirY,  y: -dirX, weight: 4 }  // 4. CW again
    ];

    // PASS 1: Initialize with Footprint
    const footprintCandidates = [];
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const pt = { x: sX + w * gridScale, y: sY + h * gridScale };
            const distF = w * dirX + h * dirY;
            const distS = Math.abs(w * sideX + h * sideY);
            pt.score = (-distF * 10) + distS; 
            footprintCandidates.push(pt);
        }
    }
    footprintCandidates.sort((a, b) => a.score - b.score);

    for (let i = 0; i < partyActors.length; i++) {
        let bestSpot = null;

        if (i < footprintCandidates.length) {
            bestSpot = footprintCandidates[i];
        } else {
            // Sequential Search: Find best adjacent spot to ANY placed token
            const lastPlaced = finalSpots[finalSpots.length - 1];
            const frontier = [];
            
            for (let j = finalSpots.length - 1; j >= 0; j--) {
                const p = finalSpots[j];
                for (const dir of searchSequence) {
                    const nx = p.x + dir.x * gridScale;
                    const ny = p.y + dir.y * gridScale;
                    const key = `${nx},${ny}`;
                    if (usedKeys.has(key)) continue;

                    const relX = (nx - sX) / gridScale;
                    const relY = (ny - sY) / gridScale;
                    const distF = relX * dirX + relY * dirY;
                    const distB = -distF;
                    const distS = Math.abs(relX * sideX + relY * sideY);

                    // Skip if ahead of front rank (rank 0)
                    if (distB < -0.1) continue;

                    const nC = { x: nx + gridScale/2, y: ny + gridScale / 2 };
                    const pC = { x: p.x + gridScale/2, y: p.y + gridScale / 2 };
                    const wall = CONFIG.Canvas.polygonBackends.move.testCollision(pC, nC, { type: "move", mode: "any" });
                    const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
                    const isLegal = !wall && reg;

                    // SCORING:
                    // 1. Proximity to Tail (Backtracking Penalty)
                    const tailPenalty = (finalSpots.length - 1 - j) * 1000000;
                    // 2. Legality
                    const legalPriority = isLegal ? 0 : 500000;
                    // 3. Lane Preference (1-wide or 2-wide)
                    const lanePriority = (distS <= laneLimit) ? 0 : 100000;
                    // 4. Rank Completion (Prefer filling the same rank/lowest rank)
                    const rankScore = Math.floor(distB + 0.5) * 100;
                    // 5. Cardinal Preference (Tie-breaker within rank)
                    const cardinalScore = dir.weight;

                    const score = tailPenalty + legalPriority + lanePriority + rankScore + cardinalScore;
                    frontier.push({ x: nx, y: ny, score });
                }
            }

            if (frontier.length > 0) {
                frontier.sort((a, b) => a.score - b.score);
                bestSpot = frontier[0];
            }
        }

        if (bestSpot) {
            finalSpots.push(bestSpot);
            usedKeys.add(`${bestSpot.x},${bestSpot.y}`);
        }
    }

    const toCreate = partyActors.slice(0, finalSpots.length).map((actor, i) => {
        const spot = finalSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
    ui.notifications.info(`Deployed ${toCreate.length} party characters.`);
}
