// Foundry VTT Macro: Party Sack Reporter
// Author: Gemini
// Description: Scans actors (specifically those flagged as 'party' in OSE) for items 
// containing "large sack". If 2+ filled sacks are found, it auto-unequips any equipped shield.

(async () => { // Wrapped in an async IIFE to allow use of 'await' for item updates

    // --- Configuration ---
    // The fragment of the item name to search for (case-insensitive)
    const ITEM_NAME_FRAGMENT = "large sack";
    // The fragment of the shield item name to search for
    const SHIELD_NAME_FRAGMENT = "shield";
    // --- End Configuration ---

    // 1. Get all relevant actors using the OSE system flag (actor.flags.ose.party === true).
    const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);

    if (partyActors.length === 0) {
        return ui.notifications.warn("No actors with the OSE 'party' flag enabled were found in the sidebar to check.");
    }

    let reportHtml = [];
    let totalSacks = 0;
    let actorsWithSacks = 0;

    for (const actor of partyActors) {
        // 2. Find items matching the name fragment AND check if they contain items.
        const matchingSacks = actor.items.filter(item => {
            // Check 1: Does the item name match the fragment?
            const isSack = item.name.toLowerCase().includes(ITEM_NAME_FRAGMENT);

            // Check 2: Does the item have contents?
            // We assume container contents are stored in item.system.contents (an array of items/IDs).
            const hasContents = item.system.contents?.length > 0;
            
            // Return true only if it is a sack AND it is holding items
            return isSack && hasContents;
        });

        const sackCount = matchingSacks.length;
        let shieldUnequipped = false; // Flag to track action for reporting
        
        // --- NEW LOGIC: Check for 2+ sacks and unequip shield ---
        if (sackCount >= 2) {
            // Found 2 or more actively used sacks. Now check for a shield.
            const equippedShield = actor.items.find(item => 
                // Check if name includes "shield" AND if it is currently marked as equipped
                item.name.toLowerCase().includes(SHIELD_NAME_FRAGMENT) && item.system.equipped
            );

            if (equippedShield) {
                // Found an equipped shield. Unequip it by setting system.equipped to false.
                try {
                    // Foundry's update method is asynchronous, so we must await it
                    await equippedShield.update({'system.equipped': false}); 
                    shieldUnequipped = true;
                } catch (e) {
                    console.error(`Error unequipping shield for ${actor.name}:`, e);
                }
            }
        }
        // --- END NEW LOGIC ---

        if (sackCount > 0) {
            // 3. Collect report data
            let actionNote = " (In Use)";
            if (shieldUnequipped) {
                actionNote += " — Shield Unequipped!";
            }

            reportHtml.push(`
                <li style="margin-left: 10px; padding: 2px 0;">
                    <span style="font-weight: bold;">${actor.name}:</span> ${sackCount} ${ITEM_NAME_FRAGMENT}${sackCount !== 1 ? 's' : ''}${actionNote}
                </li>
            `);
            totalSacks += sackCount;
            actorsWithSacks++;
        }
    }

    // 4. Generate the Chat Message
    if (actorsWithSacks > 0) {
        const headerContent = `
            <h3 style="margin: 0; font-size: 1.3em; color: #4a5568;">Party Sack Report & Load Check (OSE)</h3>
            <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #718096;">
                Found <span style="font-weight: bold; color: #2d3748;">${totalSacks}</span> '${ITEM_NAME_FRAGMENT}' items that are currently in use across ${actorsWithSacks} actor(s).
            </p>
        `;
        
        const content = `
            <div style="font-family: 'Inter', sans-serif; background-color: #f7fafc; border: 2px solid #a0aec0; border-radius: 12px; padding: 15px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <header style="padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px;">
                    ${headerContent}
                </header>
                <ul style="list-style-type: none; padding: 0; margin: 0;">
                    ${reportHtml.join('')}
                </ul>
            </div>
        `;

        ChatMessage.create({
            user: game.user.id,
            content: content,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            whisper: ChatMessage.getWhisperRecipients('GM'), // Whispers the result to only the GM
            speaker: ChatMessage.getSpeaker({alias: "System Utility"})
        });
    } else {
        // 5. Handle case where no sacks were found
        ui.notifications.info(`No OSE party actors were found possessing an item named '${ITEM_NAME_FRAGMENT}' that currently holds contents.`);
        const noSacksContent = `
            <div style="font-family: 'Inter', sans-serif; background-color: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                <h3 style="margin-top: 0; color: #38a169;">Inventory Check Complete</h3>
                <p style="margin-bottom: 0;">No items containing the name "large sack" are currently being used as a container by the OSE party characters.</p>
            </div>
        `;
        ChatMessage.create({
            user: game.user.id,
            content: noSacksContent,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            whisper: ChatMessage.getWhisperRecipients('GM'),
            speaker: ChatMessage.getSpeaker({alias: "System Utility"})
        });
    }

})();
