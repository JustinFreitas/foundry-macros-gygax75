const BANK_NAME = 'GP (Bank)';

async function applyHealingToActor(actor, healValue) {
    const healAmount = Math.min(actor.system.hp.value + (+healValue || 0), actor.system.hp.max);
    await actor.update({system: {hp: {value: healAmount}}});
}

function rollXdYSum(numberOfDice, dieSize) {
    let total = 0;
    const count = parseInt(numberOfDice, 10) || 0;
    const size = parseInt(dieSize, 10) || 0;
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * size) + 1;
        total += roll;
    }
    return total;
}

function findCharacterInSheet(twoDimensionalArray, nameToFind) {
    if (!nameToFind) return undefined;
    const target = nameToFind.trim().toLowerCase();
    for (let row = 0; row < twoDimensionalArray.length; row++) {
        for (let col = 0; col < twoDimensionalArray[row].length; col++) {
            const cell = twoDimensionalArray[row][col];
            if (typeof cell === 'string' && cell.trim().toLowerCase() === target) {
                return {row: row, col: col};
            }
        }
    }
    return undefined;
}

function findValueByLabelInBlock(twoDimensionalArray, charRow, charCol, labelToFind) {
    const maxSearchRows = Math.min(twoDimensionalArray.length, charRow + 35);
    const targetLabel = labelToFind.toLowerCase();
    for (let r = charRow; r < maxSearchRows; r++) {
        const cellVal = twoDimensionalArray[r] && twoDimensionalArray[r][charCol];
        if (typeof cellVal === 'string' && cellVal.trim().toLowerCase().includes(targetLabel)) {
            return twoDimensionalArray[r][charCol + 1];
        }
    }
    return undefined;
}

function findUpkeepForCharacterInSheet(twoDimensionalArray, nameToFind, defaultValue) {
    const characterCoords = findCharacterInSheet(twoDimensionalArray, nameToFind);
    if (characterCoords === undefined) {
        return defaultValue;
    }

    let rawVal = findValueByLabelInBlock(twoDimensionalArray, characterCoords.row, characterCoords.col, 'total cost');
    if (rawVal === undefined && twoDimensionalArray[characterCoords.row + 21]) {
        rawVal = twoDimensionalArray[characterCoords.row + 21][characterCoords.col + 1];
    }

    if (rawVal === undefined || rawVal === null) {
        return defaultValue;
    }

    const strVal = String(rawVal).replace(/,/g, '');
    const match = strVal.match(/[-+]?\d*\.?\d+/);
    return match ? match[0] : defaultValue;
}

function findHealingForCharacterInSheet(twoDimensionalArray, nameToFind, defaultValue) {
    const characterCoords = findCharacterInSheet(twoDimensionalArray, nameToFind);
    if (characterCoords === undefined) {
        return defaultValue;
    }

    let rawVal = findValueByLabelInBlock(twoDimensionalArray, characterCoords.row, characterCoords.col, 'healed');
    if (rawVal === undefined && twoDimensionalArray[characterCoords.row + 5]) {
        rawVal = twoDimensionalArray[characterCoords.row + 5][characterCoords.col + 1];
    }

    if (rawVal === undefined || rawVal === null) {
        return defaultValue;
    }

    const strVal = String(rawVal).trim().toLowerCase();
    if (strVal === '0' || strVal === '0d3' || strVal === '') {
        return 0;
    }

    const match = strVal.match(/^(\d+)\s*d\s*(\d+)/i);
    if (match) {
        return rollXdYSum(match[1], match[2]);
    }

    return defaultValue;
}

// Spreadsheet paste arrives as tab separated cells, one row per line.
function parseSheetData(sheetText) {
    return String(sheetText).split('\n').map(line => line.split('\t'));
}

// Populate every upkeep row in the dialog from a pasted "Characters in the World" sheet.
// Rows are matched on the label text, so the dialog is the only thing queried; a stray
// .actor-name elsewhere in the page can no longer shift values onto the wrong character.
function fillUpkeepRowsFromSheet(root, sheetText) {
    const sheetDataGrid = parseSheetData(sheetText);
    for (const row of root.querySelectorAll('.upkeep-row')) {
        const nameLabel = row.querySelector('.actor-name');
        const upkeepInput = row.querySelector('input.character');
        const healInput = row.querySelector('input.heal');
        if (!nameLabel || !upkeepInput || !healInput) continue;

        const baseActorName = nameLabel.textContent.split('(')[0].trim();
        const foundInSheet = findCharacterInSheet(sheetDataGrid, baseActorName) !== undefined;
        upkeepInput.value = findUpkeepForCharacterInSheet(sheetDataGrid, baseActorName, '');
        healInput.value = findHealingForCharacterInSheet(sheetDataGrid, baseActorName, 0);
        upkeepInput.placeholder = foundInSheet ? '' : 'Not found in sheet';
        row.classList.toggle('not-found', !foundInSheet);
        console.log('Setting upkeep for ' + baseActorName + ' to ' + upkeepInput.value + ' and heal to ' + healInput.value);
    }
}

// Read the clipboard straight off the event rather than waiting a tick and reading the
// textarea back, which was racy.
function onPasteSheetData(event, root) {
    const sheetText = event.clipboardData?.getData('text/plain');
    if (!sheetText) return;
    event.preventDefault();
    event.target.value = sheetText;
    fillUpkeepRowsFromSheet(root, sheetText);
}

if (document?.getElementById('sheet-data')) {
    console.log('Upkeep Input Window Already Open');
} else {
    const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true && actor.system.details?.class !== 'Mule');
    const pcsInParty = partyActors.filter(actor => !actor.system.retainer?.enabled);
    const retainersInGame = game.actors.filter(actor => actor.type === 'character' && actor.system.retainer?.enabled && actor.system.details?.class !== 'Mule');

    const formHtml = [];
    formHtml.push(`
<style>
  .upkeep-dialog {
    font-family: 'Signika', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #f0f0f0;
    background: #111417;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #c9a054;
  }
  .upkeep-dialog label {
    font-weight: bold;
    color: #e0e0e0;
  }
  .upkeep-dialog textarea#sheet-data {
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    background: #2a3036;
    color: #ffffff;
    border: 1px solid #5a5f64;
    border-radius: 4px;
    padding: 4px;
    font-family: monospace;
    resize: vertical;
  }
  .upkeep-dialog .upkeep-hint {
    color: #b0b0b0;
    font-size: 0.85em;
    line-height: 1.35;
    margin: 8px 0 0;
  }
  .upkeep-dialog .upkeep-table {
    display: grid;
    grid-template-columns: 1fr 5.5rem 5.5rem;
    gap: 4px 8px;
    align-items: center;
    margin-top: 12px;
  }
  .upkeep-dialog .upkeep-head {
    display: contents;
  }
  .upkeep-dialog .upkeep-head > span {
    color: #c9a054;
    font-weight: bold;
    font-size: 0.8em;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding-bottom: 4px;
    border-bottom: 1px solid #c9a054;
  }
  .upkeep-dialog .upkeep-head > span.numeric {
    text-align: right;
  }
  .upkeep-dialog .upkeep-row {
    display: contents;
  }
  .upkeep-dialog .upkeep-row > .actor-name {
    color: #f0f0f0;
    font-weight: bold;
    font-size: 0.95em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .upkeep-dialog .upkeep-row.not-found > .actor-name {
    color: #9a9a9a;
    font-style: italic;
  }
  .upkeep-dialog .upkeep-row > input[type="number"] {
    background: #2a3036;
    color: #ffffff;
    border: 1px solid #5a5f64;
    border-radius: 4px;
    padding: 3px 5px;
    width: 100%;
    text-align: right;
    height: auto;
  }
  .upkeep-dialog .upkeep-row > input[type="number"]:focus {
    border-color: #c9a054;
    box-shadow: 0 0 6px rgba(201, 160, 84, 0.5);
    outline: none;
  }
  .upkeep-dialog .upkeep-row > input[type="number"]::placeholder {
    font-style: italic;
    font-size: 0.8em;
    color: #8a8a8a;
  }
  .upkeep-dialog .upkeep-empty {
    color: #b0b0b0;
    font-style: italic;
    margin: 12px 0 0;
  }
</style>
<div class="upkeep-dialog">
    <label for="sheet-data">Sheet Data</label>
    <textarea id="sheet-data" rows="4" placeholder="Paste all Characters in World spreadsheet data here, otherwise, use number fields below."></textarea>
    <p class="upkeep-hint">To initialize the upkeep values below, paste the Characters in the World spreadsheet data into the box above.
    Go to the sheet and Ctrl-A to select all, then Ctrl-C to copy. Come back here, click in the box, and press Ctrl-V.
    The first column is upkeep gold and the second is heal HP.</p>
`);

    if (pcsInParty.length > 0) {
        formHtml.push(`
    <div class="upkeep-table">
        <div class="upkeep-head">
            <span>Character</span>
            <span class="numeric">Upkeep gp</span>
            <span class="numeric">Heal HP</span>
        </div>`);
        for (const actor of pcsInParty) {
            formHtml.push(`
        <div class="upkeep-row" data-actor-id="${actor.id}">
            <label class="actor-name">${actor.name}</label>
            <input type="number" class="character" min="0" step="0.5" />
            <input type="number" class="heal" min="0" step="1" />
        </div>`);
        }
        formHtml.push(`
    </div>`);
    } else {
        formHtml.push(`
    <p class="upkeep-empty">No characters in party.</p>`);
    }

    formHtml.push(`
</div>`);

    // Passing a <div> rather than a string keeps DialogV2 from running the content through
    // foundry.utils.cleanHTML(), which strips <style> blocks and unlisted attributes such as
    // the textarea placeholder. The element must carry no attributes of its own.
    const content = document.createElement('div');
    content.innerHTML = formHtml.join('\n');

    const { DialogV2 } = foundry.applications.api;
    const dialog = new DialogV2({
        classes: ["ose", "dialog"],
        position: { width: 460, height: "auto" },
        window: { title: "Character Upkeep Deductions" },
        content: content,
        buttons: [
            {
                action: "calculate",
                label: "Process Upkeep",
                default: true,
                callback: async (event, button, dialog) => {
                    const root = dialog.element;
                    const rows = Array.from(root.querySelectorAll('.upkeep-row'));
                    const actorLogs = [];
                    actorLogs.push('<h4>Character Upkeep Report</h4>');
                    let reported = 0;
                    for (const row of rows) {
                        const actor = game.actors.get(row.dataset.actorId);
                        if (!actor) {
                            console.log('Upkeep: actor ' + row.dataset.actorId + ' no longer exists, skipping.');
                            continue;
                        }
                        const healValue = (+row.querySelector('input.heal')?.value || 0);

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

                        if (reported > 0) {
                            actorLogs.push('<br/>');
                        }
                        reported++;

                        // *** Upkeep Deduction and Report ***
                        // Coerce to a number once and validate, so non-numeric or
                        // negative input can never flow into the bank as NaN.
                        const bankedGoldInput = Number(row.querySelector('input.character')?.value);
                        const actorBank = actor.items.getName(BANK_NAME);

                        if (actorBank) {
                            if (!Number.isFinite(bankedGoldInput) || bankedGoldInput <= 0) {
                                actorLogs.push(`${boldActorName}: No Downtime Cost.</br>`);
                            } else {
                                // The bank ledger is a coin pile, so charge whole gp. Name the exact
                                // sheet figure when rounding moved it so the extra isn't hidden.
                                const bankedGold = Math.ceil(bankedGoldInput);
                                const exactNote = bankedGold === bankedGoldInput ? '' : ` (sheet: ${bankedGoldInput})`;
                                const currentGold = Math.ceil(+actorBank.system.quantity.value);
                                const newGold = currentGold - bankedGold;
                                // OSE's quantity NumberField has min: 0 and silently clamps, so a
                                // deficit would vanish without a word. Write the floor and say so.
                                await actorBank.update({system: {quantity: {value: Math.max(newGold, 0)}}});
                                actorLogs.push(newGold >= 0
                                    ? `${boldActorName}: Cost of living <b>${bankedGold}gp</b>${exactNote}. Bank balance changed from ${currentGold}gp to ${newGold}gp.</br>`
                                    : `${boldActorName}: Cost of living <b>${bankedGold}gp</b>${exactNote}. Bank emptied from ${currentGold}gp; still short <b>${Math.abs(newGold)}gp</b>.</br>`);
                            }
                        } else {
                            actorLogs.push(`${boldActorName}: No bank ledger named ${BANK_NAME}</br>`);
                        }

                        // *** Retainer Healing and Report ***
                        // Process healing for retainers ONLY IF healValue > 0.
                        if (healValue > 0) {
                            const baseActorName = actor.name.split('(')[0].trim().toLowerCase();
                            for (const retainer of retainersInGame) {
                                if (retainer.name.toLowerCase().includes(`(${baseActorName})`)) {
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

                    const chatMessage = reported > 0 ? actorLogs.join('') : 'No characters in party';
                    ChatMessage.create({
                        content: chatMessage,
                    });
                }
            },
            {
                action: "close",
                label: "Close"
            }
        ]
    });

    // The dialog content is injected with innerHTML, which never executes <script> tags, so
    // behavior has to be wired up once the DOM exists.
    dialog.addEventListener("render", (event) => {
        const root = event.target.element;
        const sheetDataTextArea = root.querySelector('#sheet-data');
        if (sheetDataTextArea) {
            sheetDataTextArea.addEventListener('paste', (pasteEvent) => onPasteSheetData(pasteEvent, root));
        }
    });

    dialog.render(true);
}
