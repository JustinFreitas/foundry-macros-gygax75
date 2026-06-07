// Party Sheet Deploy V16 (Tail-Following Tactical Formation)
// Ranks 1-4 take the front (Footprint), Ranks 5-9 strictly follow the tail BEHIND them.

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
            // Footprint scoring: front row first
            pt.score = (-distF * 10) + distS;
            footprintCandidates.push(pt);
        }
    }
    footprintCandidates.sort((a, b) => a.score - b.score);

    // 2. Sequential Placement
    for (let i = 0; i < partyActors.length; i++) {
        let bestSpot = null;

        if (i < footprintCandidates.length) {
            // Fill footprint first
            bestSpot = footprintCandidates[i];
        } else {
            // Find best adjacent spot to the current TAIL of the group
            let parentIdx = i - 1;
            while (parentIdx >= 0 && !bestSpot) {
                const parent = finalSpots[parentIdx];
                let neighbors = [
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

                        const tailPenalty = (i - 1 - parentIdx) * 50000;
                        const legalPriority = isLegal ? 0 : 20000;
                        const lanePriority = (distS <= laneLimit) ? 0 : 10000;
                        // For ranks BEHIND, we want LOW distB (close to footprint) but > 0
                        const rankPriority = (distB > 0) ? (distB * 10) : 5000;
                        
                        const score = tailPenalty + legalPriority + lanePriority + rankPriority + distS;
                        return { ...n, score };
                    });

                    scored.sort((a, b) => a.score - b.score);
                    bestSpot = scored[0];
                } else {
                    parentIdx--; 
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
