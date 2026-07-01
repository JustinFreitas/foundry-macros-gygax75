// --- 1. FORCE SIZE CALCULATION ---

// Check if the current scene name includes "expedition" (case-insensitive)
const currentSceneName = game.canvas.scene.name.toLowerCase();
const isExpeditionScene = currentSceneName.includes('expedition');

// We track TWO consumer counts (RAW alignment):
//  - rationForce: who eats carried RATIONS = PCs + retainers only. Mercenaries are
//    excluded because their wages already include food (OSE Mercenary Forces RAW).
//  - waterForce:  who drinks carried WATER  = PCs + retainers + mercenaries. In the
//    desert the party must supply water for hirelings (water is not part of the wage).
//  Pack/mount animals (wagon/mule/horse/camel) and item piles are excluded from both.
let rationForce = 0;
let waterForce = 0;
let forceMembers = [];          // ration-eaters (PCs + retainers), shown in the roster
let waterMembers = [];          // water-drinkers (PCs + retainers + mercenaries)
const EXCLUSION_WORDS = ['wagon', 'mule', 'horse', 'camel'];

if (isExpeditionScene) {
    const allTokens = canvas.tokens.placeables;

    for (const token of allTokens) {
        const actor = token.actor;
        if (!actor) continue;
        if (actor.type === 'pile') continue;

        const actorNameLower = actor.name.toLowerCase();
        const actorClass = actor.system.details?.class?.toLowerCase() || '';

        // MERCENARIES: drink water but do NOT eat carried rations (wages include food).
        if (actorClass.includes('mercenary')) {
            const match = actor.name.match(/\((?<count>\d+)\)/);
            const count = match?.groups?.count ? parseInt(match.groups.count) : 1;
            if (count > 0) {
                const baseName = actor.name.replace(/\(\d+\)/, '').trim();
                for (let i = 1; i <= count; i++) {
                    waterMembers.push(`${baseName} #${i} (Mercenary)`);
                }
                waterForce += count;
            }
            continue;
        }

        // Pack/mount animals: consume neither carried rations nor carried water here.
        const classExclusions = EXCLUSION_WORDS.some(word => actorClass.includes(word));
        const nameOrTypeExclusions = EXCLUSION_WORDS.some(word =>
            actorNameLower.includes(word) ||
            actor.type.toLowerCase().includes(word)
        );
        if (classExclusions || nameOrTypeExclusions) continue;

        // PCs / retainers / other individuals: eat rations AND drink water.
        forceMembers.push(actor.name);
        waterMembers.push(actor.name);
        rationForce += 1;
        waterForce += 1;
    }
}

// --- ITEM SEPARATION, SORTING, AND CALCULATION UTILITIES ---

// Utility function to parse date from item name "Rations, Preserved Meat (8/15/2025)"
function parseExpirationDate(itemName) {
    const match = itemName.name.match(/\((?<date>\d{1,2}\/\d{1,2}\/\d{4})\)/) || itemName.match(/\((?<date>\d{1,2}\/\d{1,2}\/\d{4})\)/);
    if (!match || !match.groups || !match.groups.date) {
        return new Date(9999, 11, 31); 
    }
    return new Date(match.groups.date);
}

// Dialog Color Utility (0=Red, 1-3=Yellow/Orange, 4+=Green)
function getDaysColor(daysRemaining) {
    if (typeof daysRemaining !== 'number') return 'green'; 
    
    if (daysRemaining === 0) {
        return 'red';
    } else if (daysRemaining >= 1 && daysRemaining <= 3) {
        return 'orange'; 
    } else {
        return 'green';
    }
}


if (canvas.tokens.controlled.length !== 1) {
    ui.notifications.warn("Please select a single character token for consumption.");
    return;
}

const token = canvas.tokens.controlled[0];
const actor = token.actor;

const allConsumables = actor.items.filter(item => 
    item.name.toLowerCase().includes('water') || 
    item.name.toLowerCase().includes('ration')
);

const waterItems = allConsumables.filter(item => item.name.toLowerCase().includes('water'));
let rationItems = allConsumables.filter(item => item.name.toLowerCase().includes('ration'));

// Sort Rations by expiration date (FIFO: earliest date first)
rationItems.sort((a, b) => {
    const dateA = parseExpirationDate(a);
    const dateB = parseExpirationDate(b);
    return dateA.getTime() - dateB.getTime();
});

const consumableItems = [...rationItems, ...waterItems]; 


if (consumableItems.length === 0) {
    ui.notifications.info(`${actor.name} does not have any Rations or Water.`);
    return;
}

// --- CALCULATE TOTALS FOR SUMMARY (Used in both dialogs) ---
let totalRations = 0;
let totalWaterUnits = 0; 
for (const item of consumableItems) {
    const quantity = item.system.quantity.value ?? 0;
    if (quantity === 0) continue;

    if (item.name.toLowerCase().includes('ration')) {
        totalRations += quantity;
    } else if (item.name.toLowerCase().includes('water')) {
        const isWaterskin = item.name.toLowerCase().includes('waterskin');
        const unitsPerItem = isWaterskin ? 0.5 : 1; 
        totalWaterUnits += quantity * unitsPerItem; 
    }
}

const totalDaysOfRations = rationForce > 0 ? Math.floor(totalRations / rationForce) : "N/A";
const totalDaysOfWater = waterForce > 0 ? Math.floor(totalWaterUnits / waterForce) : "N/A";

const rationColor = getDaysColor(totalDaysOfRations);
const waterColor = getDaysColor(totalDaysOfWater);

// FIXED: Force List HTML applies max-height/overflow to the inner list container for stable resizing.
// Water-only members (mercenaries) are tagged so it's clear they consume water but not rations.
const mercWaterMembers = waterMembers.filter(n => !forceMembers.includes(n));
const rosterEntries = [
    ...forceMembers.map(name => `<li>- ${name}</li>`),
    ...mercWaterMembers.map(name => `<li>- ${name} <em>(water only)</em></li>`)
];
const forceListHtml = rosterEntries.length > 0
    ? `<div style="max-height: 100px; overflow-y: auto; padding-left: 10px;"><ul style="list-style-type: none; margin: 0; padding: 0; font-size: 0.9em;">${rosterEntries.join('')}</ul></div>`
    : `<p style="padding-left: 10px; font-size: 0.9em;">No eligible members found on this scene.</p>`;

// --- 2. CHAT CARD GENERATION FUNCTION ---
/**
 * Generates and outputs the chat card with results.
 * @param {number} unitsFed - The calculated integer quantity of force members fed by foraging.
 * @param {number} totalRationRequested - Units supplied by consumed rations (0 if skipping dialog).
 * @param {number} totalWaterRequested - Units supplied by consumed water (0 if skipping dialog).
 * @param {Array<object>} updates - Array of item updates (empty if skipping dialog).
 * @param {Array<string>} logMessages - Array of log messages (empty if skipping dialog).
 */
async function generateChatCard(unitsFed, totalRationRequested, totalWaterRequested, updates, logMessages) {
    
    // Foraging covers both food and water need; "fully fed" means it covers the largest
    // consumer group (water-drinkers), which implies rations are covered too.
    const fullyFedByForaging = waterForce > 0 && unitsFed >= waterForce;

    // Only update if there are actual changes (avoid unnecessary DB writes)
    if (updates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", updates);
        ui.notifications.info(`${actor.name}'s inventory updated.`);
    } else if (fullyFedByForaging) {
        // Only notify about foraging if no items were consumed (and we're not inside the consumption dialog callback)
        ui.notifications.info(`${actor.name}'s force was fully fed by foraging.`);
    }
    
    // --- Calculate Final State ---
    const tempActorData = {};
    actor.items.forEach(item => tempActorData[item.id] = item.system.quantity.value ?? 0);
    updates.forEach(update => tempActorData[update._id] = update['system.quantity.value']);

    let finalRations = 0;
    let finalWaterUnits = 0;
    
    // Calculate *remaining* resources based on the theoretical final state
    for (const item of consumableItems) {
        // Use tempActorData if an update was recorded, otherwise use existing quantity
        const finalQuantity = (tempActorData[item.id] ?? item.system.quantity.value ?? 0);
        
        if (item.name.toLowerCase().includes('ration')) {
            finalRations += finalQuantity;
        } else if (item.name.toLowerCase().includes('water')) {
            const isWaterskin = item.name.toLowerCase().includes('waterskin');
            const unitFactor = isWaterskin ? 0.5 : 1;
            finalWaterUnits += finalQuantity * unitFactor;
        }
    }
    
    // DAYS REMAINING CALCULATION (rations vs the eaters, water vs the drinkers)
    const daysOfRationsLeft = rationForce > 0 ? Math.floor(finalRations / rationForce) : "N/A";
    const daysOfWaterLeft = waterForce > 0 ? Math.floor(finalWaterUnits / waterForce) : "N/A";

    
    // ----------------------------------------------------------------
    // CHAT CARD COLOR/STATUS LOGIC
    // ----------------------------------------------------------------
    const LOW_STOCK_THRESHOLD = 3;
    const DARK_AMBER = '#cc9900'; 
    
    const isRationSufficient = finalRations >= rationForce;
    const isWaterSufficient = finalWaterUnits >= waterForce;

    const isRationLow = (daysOfRationsLeft !== "N/A" && daysOfRationsLeft <= LOW_STOCK_THRESHOLD && daysOfRationsLeft > 0);
    const isWaterLow = (daysOfWaterLeft !== "N/A" && daysOfWaterLeft <= LOW_STOCK_THRESHOLD && daysOfWaterLeft > 0);

    const isRationCritical = finalRations < rationForce;
    const isWaterCritical = finalWaterUnits < waterForce;

    let headerColor = 'green';
    let headerText = 'Resources Updated: Force Sustained';
    let forceNotSustainedDetails = '';
    
    if (isRationCritical || isWaterCritical) {
        headerColor = 'red';
        
        // Check if force was ACTUALLY NOT sustained (less than 1 unit per member supplied from all sources).
        // Rations are measured against the eaters (PCs+retainers); water against the drinkers (+mercenaries).
        if (totalRationRequested + unitsFed < rationForce || totalWaterRequested + unitsFed < waterForce) {
            headerText = 'Resources Updated:<br>Force Not Sustained';
            const rationsSupplied = totalRationRequested + unitsFed;
            const waterSupplied = totalWaterRequested + unitsFed;

            forceNotSustainedDetails = `
                <p style="font-weight: bold; color: #cc0000; margin-left: 5px;">Rations Supplied: ${rationsSupplied} (Eaters: ${rationForce})</p>
                <p style="font-weight: bold; color: #cc0000; margin-left: 5px;">Water Supplied: ${waterSupplied} (Drinkers: ${waterForce})</p>
                <hr style="margin: 5px 0;">
            `;
        } else {
            headerText = 'Resources Updated: Force Sustained<br>Critical Stock Warning'; 
        }
        
    } else if (isRationLow || isWaterLow) {
        headerColor = DARK_AMBER; 
        headerText = 'Resources Updated: Force Sustained<br>Low Stock Warning'; 
    }
    
    // Special header for 100% foraging
    if (fullyFedByForaging && updates.length === 0) {
       headerColor = 'green'; 
       headerText = 'Resources Updated: Force Sustained (100% Foraging)';
       forceNotSustainedDetails = `
            <p style="font-weight: bold; color: green; margin-left: 5px;">Daily needs fully met by Foraging.</p>
            <hr style="margin: 5px 0;">
       `;
    }

    
    function getResourceStatus(isCritical, isLow, isSufficient) {
        if (isCritical) {
            return { text: "Insufficient", color: "red" };
        } else if (isLow) {
            return { text: "Low", color: DARK_AMBER }; 
        } else {
            return { text: "Sufficient", color: "green" };
        }
    }

    const rationStatus = getResourceStatus(isRationCritical, isRationLow, isRationSufficient);
    const waterStatus = getResourceStatus(isWaterCritical, isWaterLow, isWaterSufficient);

    
    // Build the final chat card HTML
    let chatContent = `<div style="border: 2px solid ${headerColor}; padding: 5px; border-radius: 5px;">
        <h3 style="color: black; background-color: ${headerColor}; padding: 3px; margin: -5px -5px 5px -5px; text-align: center; font-weight: bold;">${headerText}</h3>
        <p style="font-weight: bold; margin-bottom: 5px;">Force Size: ${waterForce} (Eaters: ${rationForce} &middot; Water: ${waterForce})</p>
        <hr style="margin: 5px 0;">

        ${forceNotSustainedDetails}

        ${logMessages.length > 0 ? `
        <details style="margin-bottom: 5px;">
            <summary style="font-weight: bold; cursor: pointer; color: black;">Consumption Log (Click to Expand)</summary>
            <ul style="list-style-type: none; margin: 0; padding-left: 10px; font-size: 0.95em; margin-top: 5px;">
                ${logMessages.map(msg => `<li>${msg}</li>`).join('')}
            </ul>
        </details>
        <hr style="margin: 5px 0;">
        ` : ''}
        
        
        <p style="font-weight: bold; color: ${rationStatus.color};">${rationStatus.text} Rations</p>
        <p style="margin-left: 10px;">Days of Rations Remaining: <strong>${daysOfRationsLeft}</strong> (Total Remaining: ${finalRations})</p>

        <p style="font-weight: bold; color: ${waterStatus.color};">${waterStatus.text} Water</p>
        <p style="margin-left: 10px;">Days of Water Remaining: <strong>${daysOfWaterLeft}</strong> (Total Remaining: ${finalWaterUnits})</p>

    </div>`;

    ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({actor: actor}),
        content: chatContent
    });
}


// --- 3. MAIN CONSUMPTION DIALOG FUNCTION (CALLED IF NOT 100% FORAGING) ---

/**
 * Executes the main consumption dialog logic.
 * @param {number} unitsFed - The calculated integer quantity of force members fed by foraging.
 */
function openConsumptionDialog(unitsFed) {
    
    // --- 3a. CALCULATE DEFAULT CONSUMPTION BASED ON FORAGING ---
    
    // Start with the full consumption need: 1 ration per eater, 1 water unit per drinker.
    let rationsNeededForDefault = rationForce;
    let waterUnitsNeededForDefault = waterForce;

    if (unitsFed > 0) {
        // Reduce both RATION and WATER need by the number of units fed by foraging.
        rationsNeededForDefault = Math.max(0, rationsNeededForDefault - unitsFed);
        waterUnitsNeededForDefault = Math.max(0, waterUnitsNeededForDefault - unitsFed); 
    }

    // --- 3b. Build the Dialog HTML Content with Table Structure ---

    const dialogWidth = 400;

    let consumptionNotice = '';
    if (unitsFed > 0) {
        // Calculate the percentage fed based on the water force (largest consumer group)
        const percentFed = waterForce > 0 ? Math.round((unitsFed / waterForce) * 100) : 0;
        
        // Note formatting: black text, 'Note' bolded
        consumptionNotice = `<p style="color: black; margin-bottom: 5px;"><b>Note</b>: Force needs for Rations and Water reduced by ${unitsFed}. (${percentFed}% fed by foraging)</p>`;
    }

    let content = `
        <form>
            <p style="font-weight: bold; margin-bottom: 5px;">Force Size: <span style="color: #ff6400; font-weight: bold;">${waterForce}</span> <span style="font-weight: normal; font-size: 0.9em;">(Eaters: ${rationForce} &middot; Water: ${waterForce})</span></p>

            <div style="margin-top: 5px; border-left: 4px solid #7a7971; padding-left: 8px;">
                <p style="margin: 0; font-weight: bold;">Rations Remaining: <span style="color: ${rationColor};">${totalDaysOfRations} Days</span> (Total: ${totalRations})</p>
                <p style="margin: 0; font-weight: bold;">Water Remaining: <span style="color: ${waterColor};">${totalDaysOfWater} Days</span> (Total: ${totalWaterUnits})</p>
            </div>
            
            ${consumptionNotice}
            <p style="margin-top: 10px;">Enter the quantity to consume for each item.</p>
            <table class="item-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="border-bottom: 1px solid #7a7971;">
                        <th style="width: 50%;">Item</th>
                        <th style="width: 25%; text-align: center;">Current</th>
                        <th style="width: 25%; text-align: center;">Consume</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Calculate item consumption defaults
    consumableItems.forEach(item => {
        const itemQuantity = item.system.quantity.value ?? 0;
        const itemName = item.name;
        const itemId = item.id;
        
        let defaultConsumption = 0;

        const isWaterskin = itemName.toLowerCase().includes('waterskin');
        const unitsPerItem = isWaterskin ? 0.5 : 1; 
        

        if (itemName.toLowerCase().includes('water')) {
            if (waterUnitsNeededForDefault > 0) {
                const unitsToTake = waterUnitsNeededForDefault;
                const itemsToConsume = unitsPerItem > 0 ? Math.ceil(unitsToTake / unitsPerItem) : 0;
                const finalItemsToConsume = Math.min(itemsToConsume, itemQuantity);
                const actualUnitsProvided = finalItemsToConsume * unitsPerItem;

                defaultConsumption = finalItemsToConsume;
                waterUnitsNeededForDefault -= actualUnitsProvided;
            }
        } else if (itemName.toLowerCase().includes('ration')) {
            if (rationsNeededForDefault > 0) {
                const takeFromThisRation = Math.min(rationsNeededForDefault, itemQuantity);
                defaultConsumption = takeFromThisRation;
                rationsNeededForDefault -= takeFromThisRation;
            }
        }
        
        waterUnitsNeededForDefault = Math.max(0, waterUnitsNeededForDefault);
        rationsNeededForDefault = Math.max(0, rationsNeededForDefault);


        content += `
            <tr>
                <td style="padding: 4px 0;">${itemName}</td>
                <td style="padding: 4px 0; text-align: center;">${itemQuantity}</td>
                <td style="padding: 4px 0; text-align: center;">
                    <input type="number" 
                           id="input-${itemId}" 
                           name="${itemId}" 
                           value="${defaultConsumption}" 
                           min="0" 
                           max="${itemQuantity}"
                           style="width: 90%; text-align: center;">
                </td>
            </tr>
        `;
    });

    content += `
                </tbody>
            </table>
        </form>
    `;


    // --- 3d. Create and Render the Consumption Dialog ---

    const { DialogV2 } = foundry.applications.api;
    DialogV2.wait({
        window: { title: `${actor.name}'s Consumables` },
        position: { width: dialogWidth },
        classes: ["resizable"],
        content: content,
        buttons: [
            {
                action: "consume",
                icon: '<i class="fas fa-utensils"></i>',
                label: 'Consume',
                default: true,
                callback: async (event, button, dialog) => {
                    const html = $(dialog.element);
                    
                    const updates = [];
                    let logMessages = [];
                    let errorOccurred = false;
                    
                    let totalRationRequested = 0; // Units supplied by consumed rations
                    let totalWaterRequested = 0; // Units supplied by consumed water
                    
                    // Collect consumption amounts from the dialog HTML inputs
                    consumableItems.forEach(item => {
                        const itemId = item.id;
                        const inputElement = html.find(`#input-${itemId}`)[0];
                        const requestedAmount = Math.max(0, parseInt(inputElement.value) || 0);
                        
                        const itemQuantity = item.system.quantity.value ?? 0;

                        if (requestedAmount > itemQuantity) {
                             ui.notifications.error(`[ERROR] Requested ${requestedAmount} of ${item.name} but only ${itemQuantity} is available.`);
                             errorOccurred = true;
                             return;
                        }
                        
                        if (requestedAmount > 0) {
                            
                            const isWaterskin = item.name.toLowerCase().includes('waterskin');
                            const unitsPerItem = isWaterskin ? 0.5 : 1;
                            const unitsSupplied = requestedAmount * unitsPerItem; 

                            if (item.name.toLowerCase().includes('ration')) {
                                totalRationRequested += unitsSupplied; 
                            } else if (item.name.toLowerCase().includes('water')) {
                                totalWaterRequested += unitsSupplied; 
                            }
                            
                             updates.push({
                                _id: itemId,
                                'system.quantity.value': itemQuantity - requestedAmount
                            });
                            
                            logMessages.push(`<b>${item.name}</b> - Consumed: ${requestedAmount}`);
                        }
                    });

                    if (errorOccurred) {
                        return; 
                    }
                    
                    const totalConsumedUnits = totalRationRequested + totalWaterRequested;

                    const fullyFedByForaging = waterForce > 0 && unitsFed >= waterForce;
                    if (totalConsumedUnits === 0 && updates.length === 0 && !fullyFedByForaging) {
                        ui.notifications.info("No items were consumed.");
                        return;
                    }

                    // Call the chat card generator
                    if (updates.length > 0 || fullyFedByForaging) { 
                        generateChatCard(unitsFed, totalRationRequested, totalWaterRequested, updates, logMessages);
                    }
                }
            },
            {
                action: "cancel",
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel',
                callback: () => ui.notifications.info("Consumption cancelled.")
            }
        ],
        close: () => console.log("Consumable Dialog Closed")
    }); 
}


// --- 4. RATIONS FOUND PRE-CHECK DIALOG (PERCENTAGE FED) ---

// Define the percentage options and their values
const percentOptions = [
    { value: 0.00, label: "0%" },
    { value: 0.25, label: "25%" },
    { value: 0.50, label: "50%" },
    { value: 0.75, label: "75%" },
    { value: 1.00, label: "100%" }
];

const radioButtonsHtml = percentOptions.map((option, index) => {
    const isChecked = index === 0 ? 'checked' : ''; // Default to 0%
    return `
        <input type="radio" id="percent-${option.value}" name="percent_fed" value="${option.value}" ${isChecked}>
        <label for="percent-${option.value}" style="margin-right: 15px; font-weight: normal;">${option.label}</label>
    `;
}).join('');


const preCheckContent = `
    <form>
        <details style="border-bottom: 2px solid #7a7971; margin-top: 0;">
            <summary style="font-weight: bold; cursor: pointer; padding-bottom: 5px;">
                Current Force Size: <span style="color: #ff6400; font-weight: bold;">${waterForce}</span> (Eaters: ${rationForce} &middot; Water: ${waterForce}) (Click to view members)
            </summary>
            ${forceListHtml}
        </details>
        
        <div style="margin-top: 10px; border-left: 4px solid #7a7971; padding-left: 8px;">
            <p style="margin: 0; font-weight: bold;">Rations Remaining: <span style="color: ${rationColor};">${totalDaysOfRations} Days</span> (Total: ${totalRations})</p>
            <p style="margin: 0; font-weight: bold;">Water Remaining: <span style="color: ${waterColor};">${totalDaysOfWater} Days</span> (Total: ${totalWaterUnits})</p>
        </div>
        
        <p style="margin-top: 15px;">Did foraging partially or fully cover the force's needs for the day?</p>
        <div class="form-group" style="display: flex; justify-content: space-around; padding: 10px 0; border: 1px solid #7a7971; border-radius: 3px;">
            ${radioButtonsHtml}
        </div>
    </form>
`;

const { DialogV2 } = foundry.applications.api;
DialogV2.wait({
    window: { title: `${actor.name}'s Daily Foraging Check` },
    position: { width: 400 },
    classes: ["resizable"],
    content: preCheckContent,
    buttons: [
        {
            action: "proceed",
            icon: '<i class="fas fa-arrow-right"></i>',
            label: 'Continue',
            default: true,
            callback: (event, button, dialog) => {
                const html = $(dialog.element);
                // Get the selected percentage value (0.0 to 1.0)
                const selectedValue = parseFloat(html.find('input[name="percent_fed"]:checked').val());
                
                // Calculate units fed (always rounding down), based on the water force (largest group)
                const unitsFed = Math.floor(waterForce * selectedValue);

                // --- NEW SKIP LOGIC ---
                // If the force is 100% fed by foraging, skip the consumption dialog and go straight to the card.
                if (waterForce > 0 && unitsFed >= waterForce) {
                    // unitsFed > 0, requests = 0, updates = [], logMessages = []
                    generateChatCard(unitsFed, 0, 0, [], []);
                    return;
                }
                
                // Otherwise, proceed to the manual consumption dialog
                openConsumptionDialog(unitsFed);
            }
        },
        {
            action: "cancel",
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel All',
            callback: () => ui.notifications.info("Daily check cancelled.")
        }
    ]
});
