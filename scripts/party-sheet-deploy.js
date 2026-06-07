// Party Sheet Deploy V17 (Greedy Snake Formation)
// Places tokens one-by-one, strictly adjacent to the tail, prioritizing flow over walls.

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

    // 1. Initial candidates: all squares in the footprint
    const footprintCandidates = [];
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const pt = { x: sX + w * gridScale, y: sY + h * gridScale };
            const distF = w * dirX + h * dirY;
            const distS = Math.abs(w * sideX + h * sideY);
            pt.score = (-distF * 10) + distS; // Footprint front-to-back
            footprintCandidates.push(pt);
        }
    }
    footprintCandidates.sort((a, b) => a.score - b.score);

    // 2. Sequential "Greedy Snake" Placement
    for (let i = 0; i < partyActors.length; i++) {
        let bestSpot = null;

        if (i < footprintCandidates.length) {
            // Priority 1: Fill footprint first
            bestSpot = footprintCandidates[i];
        } else {
            // Priority 2: Find best adjacent spot to the current TAIL
            // We backtrack ONLY if the immediate tail has 0 available neighbors.
            let parentIdx = i - 1;
            while (parentIdx >= 0 && !bestSpot) {
                const parent = finalSpots[parentIdx];
                const neighbors = [
                    {x:parent.x+gridScale,y:parent.y}, {x:parent.x-gridScale,y:parent.y},
                    {x:parent.x,y:parent.y+gridScale}, {x:parent.x,y:parent.y-gridScale}
                ].filter(n => !usedKeys.has(`${n.x},${n.y}`));

                if (neighbors.length > 0) {
                    const scored = neighbors.map(n => {
                        const relX = (n.x - sX) / gridScale;
                        const relY = (n.y - sY) / gridScale;
                        // distB: Distance BEHIND the facing direction (e.g., South if facing North)
                        const distB = -(relX * dirX + relY * dirY);
                        const distS = Math.abs(relX * sideX + relY * sideY);

                        const nC = { x: n.x + gridScale/2, y: n.y + gridScale / 2 };
                        const pC = { x: parent.x + gridScale/2, y: parent.y + gridScale / 2 };
                        const wall = CONFIG.Canvas.polygonBackends.move.testCollision(pC, nC, { type: "move", mode: "any" });
                        const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
                        const isLegal = !wall && reg;

                        // SCORES:
                        // Discovery Penalty: Prioritize parent closer to the end of the line
                        const discoveryPenalty = (i - 1 - parentIdx) * 1000000;
                        // Legality Preference: Prefer spots without walls, but DON'T FILTER
                        const illegalPenalty = isLegal ? 0 : 500000;
                        // Lane Preference: Stay in 2-wide (or 1-wide) column
                        const lanePenalty = (distS <= laneLimit) ? 0 : 100000;
                        // Tactical Rank: Prefer filling closer ranks
                        const rankScore = (distB >= -0.1) ? (distB * 10) : (5000 + Math.abs(distB) * 10);
                        
                        const score = discoveryPenalty + illegalPenalty + lanePenalty + rankScore + distS;
                        return { ...n, score };
                    });

                    scored.sort((a, b) => a.score - b.score);
                    bestSpot = scored[0];
                } else {
                    parentIdx--; // Tail is trapped, try previous member
                }
            }
        }

        if (bestSpot) {
            finalSpots.push(bestSpot);
            usedKeys.add(`${bestSpot.x},${bestSpot.y}`);
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
