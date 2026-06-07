// Party Sheet Deploy V20 (Two-Tier Tactical Snake)
// Fills ranks completely (2-wide) before moving back. Strictly contiguous and wall-breaking.

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

    // Cardinal Sequence: [Opposite, CW, CW, CW]
    const searchSequence = [
        { x: -dirX, y: -dirY, weight: 1 }, // Back
        { x: -dirY, y: dirX,  weight: 2 }, // CW
        { x: dirX,  y: dirY,  weight: 3 }, // Front
        { x: dirY,  y: -dirX, weight: 4 }  // CW
    ];

    // PASS 1: Initialize with Footprint (Front-to-Back)
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
            // Sequential Tactical Search
            const frontier = [];
            const illegalFrontier = [];
            
            // Search neighbors of ALL placed tokens to find the best LEGAL spot
            for (let j = finalSpots.length - 1; j >= 0; j--) {
                const parent = finalSpots[j];
                for (const dir of searchSequence) {
                    const nx = parent.x + dir.x * gridScale;
                    const ny = parent.y + dir.y * gridScale;
                    const key = `${nx},${ny}`;
                    if (usedKeys.has(key)) continue;

                    const relX = (nx - sX) / gridScale;
                    const relY = (ny - sY) / gridScale;
                    const distF = relX * dirX + relY * dirY;
                    const distB = -distF;
                    const distS = Math.abs(relX * sideX + relY * sideY);

                    // Skip spots ahead of front rank
                    if (distB < -0.1) continue;

                    const nC = { x: nx + gridScale/2, y: ny + gridScale / 2 };
                    const pC = { x: parent.x + gridScale/2, y: parent.y + gridScale / 2 };
                    const wall = CONFIG.Canvas.polygonBackends.move.testCollision(pC, nC, { type: "move", mode: "any" });
                    const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
                    const isLegal = !wall && reg;

                    // SCORE COMPONENTS:
                    const lanePriority = (distS <= laneLimit) ? 0 : 500000;
                    const rankScore = Math.floor(distB + 0.5) * 10000;
                    const tailPenalty = (finalSpots.length - 1 - j) * 1000;
                    const score = lanePriority + rankScore + tailPenalty + dir.weight;

                    const candidate = { x: nx, y: ny, score };
                    if (isLegal) frontier.push(candidate);
                    else illegalFrontier.push(candidate);
                }
            }

            if (frontier.length > 0) {
                frontier.sort((a, b) => a.score - b.score);
                bestSpot = frontier[0];
            } else if (illegalFrontier.length > 0) {
                // If NO legal spots, pick the best adjacent to the absolute TAIL
                illegalFrontier.sort((a, b) => a.score - b.score);
                bestSpot = illegalFrontier[0];
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
