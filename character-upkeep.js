async function applyHealingToActor(actor, healValue) {
    const healAmount = Math.min(actor.system.hp.value + (+healValue || 0), actor.system.hp.max);
    await actor.update({system: {hp: {value: healAmount}}});
}

if (document?.getElementById('sheet-data')) {
    console.log('Upkeep Input Window Already Open');
} else {
    const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true && actor.system.details?.class !== 'Mule');
    const formHtml = [];
    formHtml.push(`
<script type="text/javascript">
    function rollXdYSum(numberOfDice, dieSize) {
        let total = 0;
        for (let i = 0; i < numberOfDice; i++) {
            const roll = Math.floor(Math.random() * dieSize) + 1;
            total += roll;
        }
        return total;
    }
   
    function findCharacterInSheet(twoDimensionalArray, nameToFind) {
        for (let row = 0; row < twoDimensionalArray.length; row++) {
            for (let col = 0; col < twoDimensionalArray[row].length; col++) {
                if (twoDimensionalArray[row][col] === nameToFind) {
                    return {row: row, col: col};
                }
            }
        }

        return undefined;
    }

    function findUpkeepForCharacterInSheet(twoDimensionalArray, nameToFind, defaultValue) {
        const characterCoords = findCharacterInSheet(twoDimensionalArray, nameToFind);
        if (characterCoords === undefined) {
            return defaultValue;
        }

        return twoDimensionalArray[characterCoords.row + 21][characterCoords.col + 1].split('gp')[0].trim();
    }

    function findHealingForCharacterInSheet(twoDimensionalArray, nameToFind, defaultValue) {
        const characterCoords = findCharacterInSheet(twoDimensionalArray, nameToFind);
        if (characterCoords === undefined) {
            return defaultValue;
        }

        const rollComponents = twoDimensionalArray[characterCoords.row + 5][characterCoords.col + 1].trim().split('d');
        return rollComponents.length === 2 ? rollXdYSum(rollComponents[0], rollComponents[1]) : defaultValue;
    }

    function onPasteTextArea() {
        // Use setTimeout so that the pasted text can actually get there before referencing it.
        setTimeout(() => {
            const sheetDataRaw = document.getElementById('sheet-data').value;
            const sheetDataGrid = sheetDataRaw.split('\\n').map(line => line.split('\\t'));
            const partyActors = document.getElementsByClassName('actor-name');
            const characters = document.querySelectorAll('input.character');
            const heals = document.querySelectorAll('input.heal');
            for (let i = 0; i < characters.length; i++) {
                const actor = partyActors[i];
                if (actor) {
                    const baseActorName = actor.innerText.split('(')[0].trim();
                    characters[i].value = findUpkeepForCharacterInSheet(sheetDataGrid, baseActorName, '');
                    heals[i].value = findHealingForCharacterInSheet(sheetDataGrid, baseActorName, 0);
                    console.log('Setting upkeep for ' + baseActorName + ' to ' + characters[i].value + ' and heal to ' + heals[i].value);
                }
            }
        }, 0);
    }
</script>
<form>
    <div class="form-group">
        <label>Sheet Data</label>
        <textarea id="sheet-data" rows="4" placeholder="Paste all Characters in World spreadsheet data here, otherwise, use number fields below." onpaste="onPasteTextArea()"></textarea>
    </div>
    <div>
        <p>To initialize the upkeep values for the party actors below, you can paste the Characters in the world spreadsheet data in the text area above.
        Go to sheet and Ctrl-A to select all, then Ctrl-C to copy the sheet data.  Then come here, click in the text area, and press Ctrl-V to paste.
        The fields should initialize with the data from the sheet.
        The first column is upkeep gold and the second column is heal HP.</p>
    </div>
`);
    const pcsInParty = partyActors.filter(actor => !actor.system.retainer?.enabled);
    const retainersInGame = game.actors.filter(actor => actor.type === 'character' && actor.system.retainer?.enabled && actor.system.details?.class !== 'Mule');
    for (const actor of pcsInParty) {
        formHtml.push(`
            <div class="form-group">
                <label class="actor-name">${actor.name}</label>
                <input type="number" class="character" />
                <input type="number" class="heal" />
            </div>
        `);
    }   
    formHtml.push('</form>');
    
    new Dialog({
        title: "Character Upkeep Deductions",
        content: formHtml.join('\n'),
        buttons: {
            calculate: {
                label: "Process Upkeep",
                callback: async (html) => {
                    const BANK_NAME = 'GP (Bank)';
                    const characters = html.find('input.character');
                    const actorLogs = [];
                    actorLogs.push('<h4>Character Upkeep Report</h4>');
                    for (let i = 0; i < characters.length; i++) {  // characters and pcsInParty should be same length
                        const actor = pcsInParty[i];
                        const healValue = (+html.find('input.heal')[i].value || 0);

                        // --- PC HP Check (pre-update) ---
                        const currentHP = actor.system.hp.value;
                        const maxHP = actor.system.hp.max;
                        
                        // *** Healing Application ***
                        await applyHealingToActor(actor, healValue);
                        
                        let boldActorName = `<strong>${actor.name}</strong>`;
                        
                        // *** PC Healing Report ***
                        // Only report healing if healValue > 0 AND the PC was not already at max HP
                        if (healValue > 0 && currentHP < maxHP) {
                            boldActorName += ` healed to ${actor.system.hp.value}/${actor.system.hp.max}`;
                        }

                        if (i > 0) {
                            actorLogs.push('<br/>');
                        }

                        // *** Upkeep Deduction and Report ***
                        let bankedGold = characters[i].value;
                        const actorBank = actor.items.getName(BANK_NAME);

                        if (actorBank) {
                            if (bankedGold === undefined || bankedGold === '' || bankedGold <= 0) {
                                actorLogs.push(`${boldActorName}: No Downtime Cost.</br>`);
                            } else {
                                bankedGold = Math.ceil(+bankedGold);
                                const currentGold = Math.ceil(+actorBank.system.quantity.value);
                                const newGold = Math.ceil(currentGold - bankedGold);
                                await actorBank.update({system: {quantity: {value: newGold}}});
                                actorLogs.push(newGold > 0 
                                    ? `${boldActorName}: Cost of living <b>${bankedGold}gp</b>. Bank balance changed from ${currentGold}gp to ${newGold}gp.</br>`
                                    : `${boldActorName}: Cost of living <b>${bankedGold}gp</b>. Bank balance changed from ${currentGold}gp to 0 (calculated: ${newGold}).</br>`);
                            }
                        } else {
                            actorLogs.push(`${boldActorName}: No bank ledger named ${BANK_NAME}</br>`);
                        }

                        // *** Retainer Healing and Report ***
                        // Process healing for retainers ONLY IF healValue > 0.
                        if (healValue > 0) { 
                            const baseActorName = actor.name.split('(')[0].trim();
                            for (const retainer of retainersInGame) {
                                if (retainer.name.includes(`(${baseActorName})`)) {
                                    // Check retainer's HP before healing for the report check
                                    const retainerCurrentHP = retainer.system.hp.value;
                                    const retainerMaxHP = retainer.system.hp.max;
                                    
                                    await applyHealingToActor(retainer, healValue);
                                    
                                    // Only report if the retainer was NOT already at max HP
                                    if (retainerCurrentHP < retainerMaxHP) {
                                        actorLogs.push(`<strong>${retainer.name}</strong> healed to ${retainer.system.hp.value}/${retainer.system.hp.max} because master ${actor.name} healed.</br>`);
                                    }
                                }
                            }
                        }
                    }

                    const chatMessage = partyActors.length > 0 ? actorLogs.join('') : 'No characters in party';
                    ChatMessage.create({
                        content: chatMessage,
                    });
                }
            },
            close: {
                label: "Close"
            }
        },
        default: "calculate"
    }).render(true);
}
