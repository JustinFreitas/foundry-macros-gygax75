// B/X (OSE) Carousing and Recruitment Macro for Hired Help
// Handles Normal Humans, Carousing, Advertisements, Reputation, and Negotiation reaction rolls.

const WEAPONS_TABLE = {
    "Cleric": ["Mace", "Warhammer", "Club", "Staff"],
    "Magic-User": ["Dagger", "Staff"],
    "Fighter": ["Sword", "Battle Axe", "Spear", "Hand Axe", "Shortbow", "Longbow", "Crossbow", "Two-Handed Sword", "Halberd"],
    "Dwarf": ["Sword", "Battle Axe", "Spear", "Hand Axe", "Crossbow"],
    "Elf": ["Sword", "Shortbow", "Longbow", "Spear", "Dagger"],
    "Thief": ["Sword", "Shortbow", "Dagger", "Hand Axe", "Sling"],
    "Halfling": ["Sword", "Shortbow", "Dagger", "Hand Axe", "Sling"],
    "Gnome": ["Warhammer", "Sling", "Shortbow", "Dagger", "Hand Axe"],
    "Wood Elf": ["Shortbow", "Spear", "Sword", "Sling", "Dagger"],
    "Normal Human": ["Club", "Dagger", "Spear", "Short Staff"]
};

const ADVENTURING_GEAR_TABLE = [
    "Crowbar",
    "Rope (50')",
    "Rope (50') & Grappling Hook",
    "Hammer (Small) & 12 Iron Spikes",
    "Lantern & 2 Flasks of Oil",
    "3 Large Sacks",
    "Holy Water (1 flask)",
    "Wolvesbane (1 bunch)",
    "Garlic (1 bunch)",
    "Mirror (Small, steel)",
    "Flask of Oil (1 flask)",
    "10' Pole"
];

const GENEROSITY_TABLE = {
    mean: { name: "Mean", baseFee: "2sp", lootShare: "1/4", modifier: -2 },
    poor: { name: "Poor", baseFee: "5sp", lootShare: "1/3", modifier: -1 },
    standard: { name: "Standard", baseFee: "1gp", lootShare: "1/2", modifier: 0 },
    decent: { name: "Decent", baseFee: "5gp", lootShare: "2/3", modifier: 1 },
    lavish: { name: "Lavish", baseFee: "10gp", lootShare: "Full", modifier: 2 }
};

function parseCurrency(feeStr) {
    const amt = parseInt(feeStr, 10);
    const unit = feeStr.slice(-2);
    return { amt, unit };
}

function calculateFee(generosityKey, level, isDemiHuman) {
    const gen = GENEROSITY_TABLE[generosityKey];
    const { amt, unit } = parseCurrency(gen.baseFee);
    let totalAmt = amt * level;
    if (isDemiHuman) {
        totalAmt *= 2;
    }
    return `${totalAmt}${unit}`;
}

function getCharismaModifier(cha) {
    if (cha <= 3) return -2;
    if (cha <= 5) return -1;
    if (cha <= 8) return -1;
    if (cha <= 12) return 0;
    if (cha <= 15) return 1;
    if (cha <= 17) return 2;
    return 2;
}

function getMaxRetainers(cha) {
    if (cha <= 3) return 1;
    if (cha <= 5) return 2;
    if (cha <= 8) return 3;
    if (cha <= 12) return 4;
    if (cha <= 15) return 5;
    if (cha <= 17) return 6;
    return 7;
}

function getBaseLoyalty(cha) {
    if (cha <= 3) return 4;
    if (cha <= 5) return 5;
    if (cha <= 8) return 6;
    if (cha <= 12) return 7;
    if (cha <= 15) return 8;
    if (cha <= 17) return 9;
    return 10;
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}

function getWeekID() {
    if (typeof SimpleCalendar !== 'undefined') {
        const timestamp = SimpleCalendar.api.timestamp();
        const dateStr = SimpleCalendar.api.formatTimestamp(timestamp, 'M/D/YYYY');
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month - 1, day);
        return getWeekNumber(d);
    } else {
        return getWeekNumber(new Date());
    }
}

function getGameDateString() {
    if (typeof SimpleCalendar !== 'undefined') {
        const timestamp = SimpleCalendar.api.timestamp();
        return SimpleCalendar.api.formatTimestamp(timestamp, 'MM/DD/YYYY');
    }
    return new Date().toLocaleDateString();
}

function getBankGold(actor) {
    const bankItem = actor.items.getName('GP (Bank)');
    if (bankItem) {
        return Math.ceil(Number(bankItem.system.quantity?.value || 0));
    }
    return 0;
}

async function deductBankGold(actor, amount) {
    const bankItem = actor.items.getName('GP (Bank)');
    if (bankItem) {
        const currentGold = Math.ceil(Number(bankItem.system.quantity?.value || 0));
        if (currentGold >= amount) {
            await bankItem.update({ "system.quantity.value": currentGold - amount });
            return true;
        }
    }
    return false;
}

async function getReputationPenalty(pcActor) {
    if (!pcActor || !pcActor.effects) return 0;
    let totalPenalty = 0;
    for (const effect of pcActor.effects) {
        if (effect.flags?.ose?.isBadReputation) {
            totalPenalty = Math.min(totalPenalty, effect.flags.ose.penalty || 0);
        }
    }
    return totalPenalty;
}

async function addReputationEffect(pcActor, penaltyAmount) {
    const timestamp = typeof SimpleCalendar !== 'undefined' ? SimpleCalendar.api.timestamp() : Date.now();
    const effectData = {
        name: "Bad Reputation",
        icon: "icons/svg/downgrade.svg",
        flags: {
            ose: {
                isBadReputation: true,
                penalty: penaltyAmount,
                timestamp: timestamp
            }
        }
    };
    if (typeof pcActor.createEmbeddedDocuments === 'function') {
        await pcActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
}

async function checkReputationRecovery(pcActor) {
    if (!pcActor || !pcActor.effects) return false;
    const now = typeof SimpleCalendar !== 'undefined' ? SimpleCalendar.api.timestamp() : Date.now();
    const isSC = typeof SimpleCalendar !== 'undefined';
    const twoWeeks = isSC ? 14 * 24 * 60 * 60 : 14 * 24 * 60 * 60 * 1000;
    const fourWeeks = isSC ? 28 * 24 * 60 * 60 : 28 * 24 * 60 * 60 * 1000;
    
    let recovered = false;
    const effectsToDelete = [];
    
    for (const effect of pcActor.effects) {
        if (effect.flags?.ose?.isBadReputation) {
            const originalPenalty = effect.flags.ose.penalty || -1;
            const timestamp = effect.flags.ose.timestamp || 0;
            const elapsed = now - timestamp;
            const requiredTime = originalPenalty === -2 ? fourWeeks : twoWeeks;
            
            if (elapsed >= requiredTime) {
                effectsToDelete.push(effect.id || effect._id);
            }
        }
    }
    
    if (effectsToDelete.length > 0 && typeof pcActor.deleteEmbeddedDocuments === 'function') {
        await pcActor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        recovered = true;
    }
    return recovered;
}

async function getPCState(pcActor) {
    if (!pcActor) return null;
    const defaultState = {
        unlockedGnome: false,
        unlockedWoodElf: false,
        carousingSuccesses: 0,
        currentWeek: getWeekID(),
        advert: null,
        candidates: []
    };
    const state = pcActor.getFlag('ose', 'recruitmentState') || {};
    
    // MIGRATION: Convert hidden flags to Active Effects for this PC
    if (state.incidents && state.incidents.length > 0) {
        const totalPenalty = state.badReputation || -1;
        const latestTimestamp = state.incidents[state.incidents.length - 1].timestamp;
        const effectData = {
            name: "Bad Reputation",
            icon: "icons/svg/downgrade.svg",
            flags: {
                ose: {
                    isBadReputation: true,
                    penalty: totalPenalty,
                    timestamp: latestTimestamp
                }
            }
        };
        if (typeof pcActor.createEmbeddedDocuments === 'function') {
            await pcActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
        }
        
        delete state.incidents;
        delete state.badReputation;
        state['-=' + 'incidents'] = null;
        state['-=' + 'badReputation'] = null;
        await pcActor.setFlag('ose', 'recruitmentState', state);
        if (typeof ui !== 'undefined' && ui.notifications) ui.notifications.info(`Migrated hidden reputation to Active Effect for ${pcActor.name}`);
    }

    const merged = { ...defaultState, ...state };
    
    const thisWeek = getWeekID();
    if (merged.currentWeek !== thisWeek) {
        merged.currentWeek = thisWeek;
        merged.carousingSuccesses = 0;
        await pcActor.setFlag('ose', 'recruitmentState', merged);
    }
    return merged;
}

async function savePCState(pcActor, state) {
    if (!pcActor) return;
    await pcActor.setFlag('ose', 'recruitmentState', state);
}

function generateStartingEquipment(className) {
    const torchesRoll = Math.floor(Math.random() * 6) + 1;
    const rationsRoll = Math.floor(Math.random() * 6) + 1;
    const bankGPRoll = (Math.floor(Math.random() * 6) + 1) +
                       (Math.floor(Math.random() * 6) + 1) +
                       (Math.floor(Math.random() * 6) + 1);
                       
    const rolledWeapons = [];
    const weaponPool = WEAPONS_TABLE[className] || WEAPONS_TABLE["Normal Human"];
    
    const numWeapons = className === "Normal Human" || className === "Magic-User" ? 1 : (Math.random() < 0.5 ? 1 : 2);
    for (let i = 0; i < numWeapons; i++) {
        const randWeapon = weaponPool[Math.floor(Math.random() * weaponPool.length)];
        if (!rolledWeapons.includes(randWeapon)) {
            rolledWeapons.push(randWeapon);
        }
    }
    
    const rolledGear = [];
    while (rolledGear.length < 2) {
        const randGear = ADVENTURING_GEAR_TABLE[Math.floor(Math.random() * ADVENTURING_GEAR_TABLE.length)];
        if (!rolledGear.includes(randGear)) {
            rolledGear.push(randGear);
        }
    }
    
    return {
        basic: ["Sling", "Backpack", "Small Sack", "Tinderbox"],
        torches: torchesRoll,
        rations: rationsRoll,
        bankGP: bankGPRoll,
        weapons: rolledWeapons,
        gear: rolledGear
    };
}

// Dialog Layout & styling
const formHtml = `
<style>
  .recruitment-dialog {
    font-family: 'Signika', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #f0f0f0;
    background: #111417;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #c9a054;
  }
  .recruitment-tabs {
    display: flex;
    border-bottom: 2px solid #c9a054;
    margin-top: 10px;
    margin-bottom: 15px;
  }
  .recruitment-tab {
    flex: 1;
    text-align: center;
    padding: 8px;
    cursor: pointer;
    background: #1c2024;
    border: 1px solid #3a3f44;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    margin-right: 2px;
    font-weight: bold;
    color: #b0b0b0;
    font-size: 0.9em;
    transition: all 0.2s ease;
  }
  .recruitment-tab.active {
    background: #c9a054;
    color: #111417;
    border-color: #c9a054;
  }
  .recruitment-tab:hover:not(.active) {
    background: #2a3036;
    color: #ffffff;
  }
  .tab-content {
    display: none;
  }
  .tab-content.active {
    display: block;
  }
  .recruitment-card {
    background: rgba(28, 32, 36, 0.6);
    border: 1px solid #3a3f44;
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  }
  .recruitment-card h3 {
    margin-top: 0;
    border-bottom: 1px solid #c9a054;
    padding-bottom: 5px;
    color: #c9a054;
    font-size: 1.05em;
  }
  .form-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .form-row label {
    font-weight: bold;
    color: #e0e0e0;
    font-size: 0.95em;
  }
  .form-row select, .form-row input[type="text"], .form-row input[type="number"] {
    background: #2a3036;
    color: #ffffff;
    border: 1px solid #5a5f64;
    border-radius: 4px;
    padding: 4px;
    width: 55%;
  }
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .recruitment-btn {
    background: linear-gradient(180deg, #c9a054 0%, #a67c37 100%);
    color: #111417;
    border: 1px solid #8e6525;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
    text-align: center;
    margin-top: 5px;
    transition: all 0.2s ease;
  }
  .recruitment-btn:hover {
    background: linear-gradient(180deg, #d9b064 0%, #b68c47 100%);
    box-shadow: 0 0 8px rgba(201, 160, 84, 0.6);
  }
  .recruitment-btn.secondary {
    background: linear-gradient(180deg, #4a5259 0%, #2f343a 100%);
    color: #f0f0f0;
    border: 1px solid #1f2225;
  }
  .recruitment-btn.secondary:hover {
    background: linear-gradient(180deg, #5a636b 0%, #3f464d 100%);
    box-shadow: 0 0 8px rgba(255,255,255,0.2);
  }
  .candidate-list {
    max-height: 120px;
    overflow-y: auto;
    border: 1px solid #3a3f44;
    border-radius: 4px;
    background: #0f1114;
    padding: 4px;
    margin-top: 6px;
  }
  .candidate-item {
    padding: 4px 6px;
    border-bottom: 1px solid #222;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9em;
  }
  .candidate-item:hover {
    background: #1c2024;
    color: #c9a054;
  }
  .candidate-item.selected {
    background: rgba(201, 160, 84, 0.2);
    border-left: 3px solid #c9a054;
  }
  .candidate-info {
    flex-grow: 1;
  }
  .candidate-dismiss {
    color: #ff5555;
    cursor: pointer;
    font-weight: bold;
    padding: 0 4px;
  }
  .candidate-dismiss:hover {
    color: #ff8888;
  }
  .ref-notes {
    font-size: 0.85em;
    color: #b0b0b0;
    line-height: 1.3;
  }
  .ref-notes ul {
    margin: 4px 0;
    padding-left: 20px;
  }
</style>

<div class="recruitment-dialog">
  <div class="form-row">
    <label>Hiring Master PC</label>
    <select id="pc-select"></select>
  </div>
  
  <div class="recruitment-card" style="margin-bottom: 8px; padding: 6px 10px;">
    <div id="pc-stats-display" style="font-size: 0.9em;">Loading Master PC...</div>
  </div>

  <div class="recruitment-tabs">
    <div class="recruitment-tab active" data-tab="status">Tavern & Status</div>
    <div class="recruitment-tab" data-tab="carousing">Carousing & Adverts</div>
    <div class="recruitment-tab" data-tab="negotiation">Negotiation & Hire</div>
  </div>

  <!-- Tab 1: Tavern & Status -->
  <div class="tab-content active" id="tab-status">
    <div class="recruitment-card">
      <h3>Normal Humans (Tavern)</h3>
      <p style="font-size: 0.85em; margin: 4px 0;">Normal humans (Level 0) are always in Threshold tavern. No advertising needed, eager, and don't give bad reputation.</p>
      <button class="recruitment-btn" id="roll-tavern-btn">Roll Tavern Available Humans (2d4)</button>
    </div>
    
    <div class="recruitment-card">
      <h3>PC Reputation & Kill Log</h3>
      <div class="form-row">
        <label>Reputation Penalty</label>
        <select id="reputation-select" disabled>
          <option value="0">None (0)</option>
          <option value="-1">Bad Reputation (-1)</option>
          <option value="-2">Terrible Reputation (-2)</option>
        </select>
      </div>
      <div style="display: flex; gap: 4px; margin-top: 6px;">
        <button class="recruitment-btn secondary" id="log-loss-neither-btn" style="font-size: 0.8em; padding: 4px;">Lost Retainer</button>
        <button class="recruitment-btn secondary" id="log-loss-body-btn" style="font-size: 0.8em; padding: 4px;">Lost (Body Only)</button>
        <button class="recruitment-btn secondary" id="log-loss-gear-btn" style="font-size: 0.8em; padding: 4px;">Lost (Body & Gear)</button>
      </div>
      <div id="incidents-log-container" style="font-size: 0.85em; margin-top: 6px; color: #b0b0b0;"></div>
    </div>
    
    <div class="recruitment-card">
      <h3>Reference Notes</h3>
      <div class="ref-notes">
        • <b>Limit:</b> Max retainers = Charisma limit. Normal humans count against limit.<br/>
        • <b>Wages:</b> Rates multiplied by Level. Demi-Humans cost 2x.<br/>
        • <b>Upkeep:</b> Master pays daily upkeep + any required gear/mounts.<br/>
        • <b>Magic:</b> Permanent magic bestowment raises Loyalty +1 or item bonus. Consumables raise Loyalty +1 per 1000gp (non-cumulative).
      </div>
    </div>
  </div>

  <!-- Tab 2: Carousing & Adverts -->
  <div class="tab-content" id="tab-carousing">
    <div class="recruitment-card">
      <h3>Carousing (50gp/night)</h3>
      <div class="form-row">
        <span style="font-size: 0.9em; font-weight: bold;">Weekly Successes:</span>
        <span id="carousing-success-count" style="font-weight: bold; color: #c9a054;">0 / 2</span>
      </div>
      <p style="font-size: 0.85em; margin: 4px 0;">3-in-6 chance of attracting 1d3 adventurers next day from Retainer Class List. Limit: 2 successful carousings per week.</p>
      <button class="recruitment-btn" id="carouse-btn">Carouse for a Night (50gp)</button>
    </div>

    <div class="recruitment-card">
      <h3>Advertisements (25gp/7 days)</h3>
      <div id="advert-status-container" style="font-size: 0.9em; margin-bottom: 6px;">
        No active advertisement.
      </div>
      <div class="form-row" id="advert-post-controls">
        <label>Class Target</label>
        <select id="advert-class-select"></select>
      </div>
      <button class="recruitment-btn" id="post-advert-btn">Post Advertisement (25gp)</button>
      <button class="recruitment-btn secondary" id="roll-advert-btn" style="display: none; margin-top: 6px;">Roll Daily Advert Check (2-in-6)</button>
    </div>

    <div class="recruitment-card">
      <h3>Campaign Milestone Unlocks</h3>
      <div class="checkbox-row">
        <input type="checkbox" id="unlock-gnome" />
        <label for="unlock-gnome" style="font-size: 0.9em;">Gnome (Nollys Kingdom)</label>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="unlock-woodelf" />
        <label for="unlock-woodelf" style="font-size: 0.9em;">Wood Elf (Ryo Taesi)</label>
      </div>
    </div>
  </div>

  <!-- Tab 3: Negotiation & Hire -->
  <div class="tab-content" id="tab-negotiation">
    <div class="recruitment-card">
      <h3>Available Candidates</h3>
      <p style="font-size: 0.85em; margin: 4px 0; color: #b0b0b0;">Select a candidate from the list below to negotiate a contract.</p>
      <div class="candidate-list" id="candidates-container">
        <div style="padding: 10px; text-align: center; color: #666; font-size: 0.9em;">No candidates available.</div>
      </div>
    </div>

    <div class="recruitment-card" id="negotiation-controls" style="display: none;">
      <h3>Negotiate Deal</h3>
      <div class="form-row">
        <span style="font-size: 0.95em; font-weight: bold; color: #c9a054;">Selected Candidate:</span>
        <span id="selected-candidate-name" style="font-weight: bold;">None</span>
      </div>
      <div class="form-row">
        <label>Retainer Name</label>
        <input type="text" id="retainer-name-input" placeholder="e.g. Karg (defaults to Retainer/Hireling)" />
      </div>
      <div class="form-row">
        <label>Generosity Offer</label>
        <select id="generosity-select">
          <option value="mean">Mean (2sp / 1/4 loot / -2 reaction)</option>
          <option value="poor">Poor (5sp / 1/3 loot / -1 reaction)</option>
          <option value="standard" selected>Standard (1gp / 1/2 loot / 0 reaction)</option>
          <option value="decent">Decent (5gp / 2/3 loot / +1 reaction)</option>
          <option value="lavish">Lavish (10gp / Full loot / +2 reaction)</option>
        </select>
      </div>
      
      <div id="negotiation-breakdown" style="font-size: 0.85em; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; margin-bottom: 8px;">
        <!-- Filled dynamically -->
      </div>
      
      <button class="recruitment-btn" id="roll-negotiation-btn">Roll Reaction Check (2d6)</button>
      
      <div id="negotiation-result-display" style="margin-top: 8px; font-weight: bold; text-align: center; font-size: 1em; min-height: 20px;"></div>
      
      <button class="recruitment-btn" id="hire-btn" style="display: none; margin-top: 6px;">Hire & Create Retainer Actor</button>
    </div>
  </div>
</div>
`;

// Helper: Setup PC options in dialog
function initializePCSelect(html, pcs) {
    const select = html.find('#pc-select');
    select.empty();
    for (const pc of pcs) {
        select.append(`<option value="${pc.id}">${pc.name}</option>`);
    }
}

// Logic to refresh all UI fields based on active PC and state
async function refreshUI(html, pcActor, state) {
    if (!pcActor) return;
    
    // Auto-decay effects if they expired
    await checkReputationRecovery(pcActor);
    const badReputation = await getReputationPenalty(pcActor);
    
    // 1. PC Stats
    const cha = pcActor.system.scores?.cha?.value || pcActor.system.abilities?.cha?.value || 10;
    const maxRetainers = getMaxRetainers(cha);
    const reactionMod = getCharismaModifier(cha);
    const basePCName = pcActor.name.split('(')[0].trim();
    
    // Find PC's retainers
    const retainers = game.actors.filter(actor => 
        actor.type === 'character' && 
        actor.system.retainer?.enabled && 
        actor.name.includes(`(${basePCName})`)
    );
    const currentRetainersCount = retainers.length;
    const bankGold = getBankGold(pcActor);
    
    let statsHtml = `
        <strong>GP (Bank):</strong> <span style="color: #c9a054; font-weight: bold;">${bankGold}gp</span> | 
        <strong>CHA:</strong> ${cha} (Reaction Mod: ${reactionMod >= 0 ? '+' : ''}${reactionMod})<br/>
        <strong>Retainers:</strong> ${currentRetainersCount} / ${maxRetainers}
    `;
    
    if (currentRetainersCount >= maxRetainers) {
        statsHtml += `<br/><span style="color: #ff5555; font-weight: bold;">⚠ PC has reached maximum retainer limit!</span>`;
    }
    html.find('#pc-stats-display').html(statsHtml);

    // 2. Unlocks
    html.find('#unlock-gnome').prop('checked', !!state.unlockedGnome);
    html.find('#unlock-woodelf').prop('checked', !!state.unlockedWoodElf);

    // 3. Tavern Normal Humans / Reputation Penalty
    html.find('#reputation-select').val(String(badReputation));
    
    // Incidents list (Active Effects)
    let incidentText = "";
    let incidentList = [];
    if (pcActor.effects) {
        for (const effect of pcActor.effects) {
            if (effect.flags?.ose?.isBadReputation) {
                const ts = effect.flags.ose.timestamp;
                let dateStr = "Unknown Date";
                if (typeof SimpleCalendar !== 'undefined' && ts) {
                    dateStr = SimpleCalendar.api.formatTimestamp(ts, 'MM/DD/YYYY');
                } else if (ts) {
                    dateStr = new Date(ts).toLocaleDateString();
                }
                const pen = effect.flags.ose.penalty || -1;
                incidentList.push(`- ${dateStr} (Penalty: ${pen}, Expires in ${pen === -2 ? '4' : '2'} weeks)`);
            }
        }
    }
    
    if (incidentList.length > 0) {
        incidentText = "<b>Active Incidents:</b><br/>" + incidentList.join('<br/>');
    } else {
        incidentText = "No active reputation incidents recorded.";
    }
    html.find('#incidents-log-container').html(incidentText);

    // 4. Carousing weekly count
    html.find('#carousing-success-count').text(`${state.carousingSuccesses} / 2`);

    // 5. Active Advert
    const advContainer = html.find('#advert-status-container');
    const adClassSelect = html.find('#advert-class-select');
    
    // Populate advertisement class choices
    adClassSelect.empty();
    const standardClasses = ["Cleric", "Magic-User", "Fighter", "Thief", "Halfling", "Dwarf", "Elf"];
    if (state.unlockedGnome) standardClasses.push("Gnome");
    if (state.unlockedWoodElf) standardClasses.push("Wood Elf");
    for (const c of standardClasses) {
        adClassSelect.append(`<option value="${c}">${c}</option>`);
    }

    if (state.advert) {
        advContainer.html(`
            <div style="border: 1px solid #c9a054; padding: 6px; border-radius: 4px; background: rgba(201,160,84,0.1);">
                <strong>Active Board Notice:</strong> ${state.advert.className}<br/>
                <strong>Posted:</strong> ${state.advert.postedDateString}<br/>
                <strong>Days Left:</strong> ${state.advert.daysLeft}<br/>
                ${state.advert.lastRollDateString ? `<strong>Last Checked:</strong> ${state.advert.lastRollDateString}` : 'Not checked today'}
            </div>
        `);
        html.find('#advert-post-controls').hide();
        html.find('#post-advert-btn').hide();
        html.find('#roll-advert-btn').show();
    } else {
        advContainer.html("No active advertisement on the town board.");
        html.find('#advert-post-controls').show();
        html.find('#post-advert-btn').show();
        html.find('#roll-advert-btn').hide();
    }

    // 6. Candidate List
    const cContainer = html.find('#candidates-container');
    cContainer.empty();
    if (state.candidates && state.candidates.length > 0) {
        state.candidates.forEach((cand, idx) => {
            const isSelected = state.selectedCandidateId === cand.id;
            cContainer.append(`
                <div class="candidate-item ${isSelected ? 'selected' : ''}" data-id="${cand.id}">
                    <div class="candidate-info">
                        <strong>${cand.name}</strong> (${cand.className} Level ${cand.level})
                    </div>
                    <div class="candidate-dismiss" data-id="${cand.id}">✖</div>
                </div>
            `);
        });
    } else {
        cContainer.html('<div style="padding: 10px; text-align: center; color: #666; font-size: 0.9em;">No candidates available.</div>');
    }

    // 7. Negotiation Panel
    const negControls = html.find('#negotiation-controls');
    if (state.selectedCandidateId) {
        const candidate = state.candidates.find(c => c.id === state.selectedCandidateId);
        if (candidate) {
            negControls.show();
            html.find('#selected-candidate-name').text(`${candidate.name} (${candidate.className} Lvl ${candidate.level})`);
            
            // Re-calculate details
            const generosityVal = html.find('#generosity-select').val() || "standard";
            const gen = GENEROSITY_TABLE[generosityVal];
            
            const isDemiHuman = ["Dwarf", "Elf", "Halfling", "Gnome", "Wood Elf"].includes(candidate.className);
            const rawRate = calculateFee(generosityVal, candidate.level, isDemiHuman);
            
            let modBreakdown = `
                • Daily Rate Offer: <b>${rawRate}</b> (Loot Share: ${gen.lootShare})<br/>
                • PC Reaction Modifier: <b>${reactionMod >= 0 ? '+' : ''}${reactionMod}</b><br/>
                • Generosity Modifier: <b>${gen.modifier >= 0 ? '+' : ''}${gen.modifier}</b><br/>
                • Reputation Modifier: <b>${badReputation}</b><br/>
                • Net Reaction Roll Modifier: <b>${(reactionMod + gen.modifier + badReputation) >= 0 ? '+' : ''}${reactionMod + gen.modifier + badReputation}</b>
            `;
            html.find('#negotiation-breakdown').html(modBreakdown);
        } else {
            negControls.hide();
        }
    } else {
        negControls.hide();
    }
}

// Entry Point
const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags?.ose?.party === true && actor.system.details?.class !== 'Mule');
const pcsInParty = partyActors.filter(actor => !actor.system.retainer?.enabled);
const retainersInGame = game.actors.filter(actor => actor.type === 'character' && actor.system.retainer?.enabled && actor.system.details?.class !== 'Mule');

if (pcsInParty.length === 0) {
    if (typeof ui !== 'undefined' && ui.notifications) {
        ui.notifications.warn("Please add player characters (PCs) to the party sheet before using the recruitment macro.");
    } else {
        console.log("No party PCs available.");
    }
} else {
    let activePC = pcsInParty[0];
    let state = {};

    const { DialogV2 } = foundry.applications.api;
    const dialog = new DialogV2({
        classes: ["ose", "dialog"],
        window: { title: "B/X Hired Help & Carousing Tracker" },
        position: { width: 600, height: "auto" },
        content: (() => {
            const div = document.createElement("div");
            div.innerHTML = formHtml;
            return div;
        })(),
        buttons: [
            {
                action: "close",
                label: "Close Recruitment"
            }
        ]
    });
    dialog.addEventListener("render", async (event) => {
        const target = event.target.element;
        const html = $(target);
            // Setup selections
            initializePCSelect(html, pcsInParty);
            
            // Retrieve initially selected PC state
            state = await getPCState(activePC);
            await savePCState(activePC, state);
            await refreshUI(html, activePC, state);

            // TAB INTERACTION
            html.find('.recruitment-tab').click(function() {
                const tab = jQuery(this).attr('data-tab');
                html.find('.recruitment-tab').removeClass('active');
                jQuery(this).addClass('active');
                html.find('.tab-content').removeClass('active');
                html.find(`#tab-${tab}`).addClass('active');
            });

            // PC SELECT INTERACTION
            html.find('#pc-select').change(async function() {
                const pcId = jQuery(this).val();
                activePC = pcsInParty.find(pc => pc.id === pcId);
                state = await getPCState(activePC);
                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });

            // UNLOCK CHECKBOXES
            html.find('#unlock-gnome').change(async function() {
                state.unlockedGnome = jQuery(this).is(':checked');
                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });
            html.find('#unlock-woodelf').change(async function() {
                state.unlockedWoodElf = jQuery(this).is(':checked');
                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });

            // TAVERN ROLL
            html.find('#roll-tavern-btn').click(async function(e) {
                e.preventDefault();
                const rollVal = (Math.floor(Math.random() * 4) + 1) + (Math.floor(Math.random() * 4) + 1); // 2d4
                
                // Add Normal Humans
                for (let i = 0; i < rollVal; i++) {
                    const id = `nh-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    state.candidates.push({
                        id: id,
                        type: "normal",
                        name: "Normal Human",
                        className: "Normal Human",
                        level: 0
                    });
                }
                
                await savePCState(activePC, state);
                
                ChatMessage.create({
                    content: `<h4>Threshold Tavern Update</h4><p>Word gets around, and <b>${rollVal} Normal Humans</b> enter the local tavern looking for adventure!</p>`
                });
                
                await refreshUI(html, activePC, state);
            });

            // CAROUSING
            html.find('#carouse-btn').click(async function(e) {
                e.preventDefault();
                
                // Cost check
                const bankGold = getBankGold(activePC);
                if (bankGold < 50) {
                    ui.notifications.error(`Not enough gold in PC's bank. Need 50gp, but only have ${bankGold}gp.`);
                    return;
                }
                
                // Weekly count check
                if (state.carousingSuccesses >= 2) {
                    ui.notifications.warn("Only two carousings will be successful per week in Threshold. The local pool is depleted!");
                    // We can still allow rolling if the DM wants to bypass, but let's follow the standard rule
                }

                // Deduct gold
                await deductBankGold(activePC, 50);
                
                // 3-in-6 chance (rolls 1-3 on d6)
                const rollD6 = Math.floor(Math.random() * 6) + 1;
                const isSuccessful = rollD6 <= 3;
                
                if (isSuccessful) {
                    state.carousingSuccesses++;
                    
                    // 1d3 adventurers met
                    const numApplicants = Math.floor(Math.random() * 3) + 1;
                    
                    let chatDetails = [];
                    for (let i = 0; i < numApplicants; i++) {
                        // Roll class using 2d6 table
                        const classRoll = rollClass(state.unlockedGnome, state.unlockedWoodElf);
                        
                        // 1-in-6 chance one is 1d3+1 level, else level 1
                        const lvlRoll = Math.floor(Math.random() * 6) + 1;
                        const level = lvlRoll === 1 ? (Math.floor(Math.random() * 3) + 2) : 1;
                        
                        const id = `class-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        state.candidates.push({
                            id: id,
                            type: "class",
                            name: `Adventuring Candidate`,
                            className: classRoll.className,
                            level: level
                        });
                        chatDetails.push(`• <b>${classRoll.className}</b> (Level ${level})`);
                    }
                    
                    await savePCState(activePC, state);
                    
                    ChatMessage.create({
                        content: `
                            <h4>Carousing Success!</h4>
                            <p><b>${activePC.name}</b> carouses through the night, spending 50gp from their bank.</p>
                            <p><b>${numApplicants} candidates</b> apply the next day:</p>
                            ${chatDetails.join('<br/>')}
                        `
                    });
                } else {
                    ChatMessage.create({
                        content: `
                            <h4>Carousing Night</h4>
                            <p><b>${activePC.name}</b> spends 50gp carousing in the tavern, but meets no adventurers of note tonight.</p>
                        `
                    });
                }
                
                await refreshUI(html, activePC, state);
            });

            // POST ADVERTISEMENT
            html.find('#post-advert-btn').click(async function(e) {
                e.preventDefault();
                
                // Cost check
                const bankGold = getBankGold(activePC);
                if (bankGold < 25) {
                    ui.notifications.error(`Not enough gold in PC's bank. Need 25gp to advertise, but only have ${bankGold}gp.`);
                    return;
                }

                // Check if they already have an advert
                if (state.advert) {
                    ui.notifications.error("A player character may only post one advertisement notice at a time.");
                    return;
                }

                // Deduct gold
                await deductBankGold(activePC, 25);
                
                const targetClass = html.find('#advert-class-select').val();
                
                state.advert = {
                    className: targetClass,
                    postedDateString: getGameDateString(),
                    daysLeft: 7,
                    lastRollDateString: ""
                };
                
                await savePCState(activePC, state);
                
                ChatMessage.create({
                    content: `<h4>Town Notice Posted</h4><p><b>${activePC.name}</b> posts an advertisement looking for a <b>${targetClass}</b>. 25gp paid. The notice will run for 7 days.</p>`
                });
                
                await refreshUI(html, activePC, state);
            });

            // ADVERT DAILY ROLL
            html.find('#roll-advert-btn').click(async function(e) {
                e.preventDefault();
                
                if (!state.advert) return;
                
                const todayStr = getGameDateString();
                if (state.advert.lastRollDateString === todayStr) {
                    ui.notifications.warn("You have already checked this advertisement notice today.");
                    // Let the DM bypass if needed, but let's warn
                }
                
                // 2-in-6 chance (rolls 1-2 on d6)
                const rollD6 = Math.floor(Math.random() * 6) + 1;
                const isSuccessful = rollD6 <= 2;
                
                state.advert.daysLeft--;
                state.advert.lastRollDateString = todayStr;
                
                if (isSuccessful) {
                    // Specific class shows up
                    // 1-in-6 chance of 1d3+1 level, else level 1
                    const lvlRoll = Math.floor(Math.random() * 6) + 1;
                    const level = lvlRoll === 1 ? (Math.floor(Math.random() * 3) + 2) : 1;
                    
                    const id = `class-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    state.candidates.push({
                        id: id,
                        type: "class",
                        name: `Advertised Candidate`,
                        className: state.advert.className,
                        level: level
                    });
                    
                    ChatMessage.create({
                        content: `<h4>Advertisement Reply</h4><p>A response to the advert for a <b>${state.advert.className}</b>! A <b>Level ${level} ${state.advert.className}</b> shows up to offer their services.</p>`
                    });
                } else {
                    ChatMessage.create({
                        content: `<h4>Advertisement Notice</h4><p>No response to the advertisement notice today. (${state.advert.daysLeft} days remaining)</p>`
                    });
                }
                
                // Expire notice if daysLeft is 0
                if (state.advert.daysLeft <= 0) {
                    state.advert = null;
                    ChatMessage.create({
                        content: `<h4>Advertisement Expired</h4><p>The notice posted on the town board has run its course and expired.</p>`
                    });
                }
                
                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });

            html.find('#log-loss-neither-btn').click(async function(e) {
                e.preventDefault();
                await addReputationEffect(activePC, -1);
                ChatMessage.create({
                    content: `<h4>Reputation Log Update</h4><p><b>${activePC.name}</b> lost a class retainer with no body or gear recovered. PC gains bad reputation (<b>-1 penalty</b> to hiring reaction checks).</p>`
                });
                await refreshUI(html, activePC, state);
            });

            html.find('#log-loss-body-btn').click(async function(e) {
                e.preventDefault();
                // Standard reaction check 6+ on 1d20 or 1d6? "standard reaction check 6+"
                // In D&D/BX, reaction check is on 2d6, or a 1d6 roll? "standard reaction check 6+"
                // 6+ on 1d6 (5-in-6) or 6+ on 2d6? Usually reaction is 2d6, where 6+ is "neutral/accepted".
                // Let's roll 2d6 for standard reaction check 6+
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const total = d1 + d2;
                const passed = total >= 6;
                
                if (passed) {
                    ChatMessage.create({
                        content: `<h4>Reputation Check</h4><p>PC recovered the body only. Reaction check: <b>SUCCESS</b> (rolled ${total} vs 6+). No reputation penalty applied.</p>`
                    });
                } else {
                    await addReputationEffect(activePC, -1);
                    ChatMessage.create({
                        content: `
                            <h4>Reputation Check</h4>
                            <p>PC recovered the body only. Reaction check: <b>FAILED</b> (rolled ${total} vs 6+).</p>
                            <p>PC gains bad reputation (<b>-1 penalty</b> to hiring reaction checks).</p>
                        `
                    });
                }
                await refreshUI(html, activePC, state);
            });

            html.find('#log-loss-gear-btn').click(async function(e) {
                e.preventDefault();
                ChatMessage.create({
                    content: `<h4>Reputation Notice</h4><p>PC brought back the body of the retainer with their possessions. No bad reputation penalty is incurred.</p>`
                });
                await refreshUI(html, activePC, state);
            });

            // SELECTING A CANDIDATE FOR NEGOTIATION
            html.find('#candidates-container').on('click', '.candidate-item', async function(e) {
                // Ignore if clicked dismiss button
                if (jQuery(e.target).hasClass('candidate-dismiss')) return;
                
                const id = jQuery(this).attr('data-id');
                state.selectedCandidateId = id;
                
                // Clear any previous negotiation outcomes
                html.find('#negotiation-result-display').empty();
                html.find('#hire-btn').hide();
                
                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });

            // DISMISS CANDIDATE
            html.find('#candidates-container').on('click', '.candidate-dismiss', async function(e) {
                e.stopPropagation();
                const id = jQuery(this).attr('data-id');
                
                state.candidates = state.candidates.filter(c => c.id !== id);
                if (state.selectedCandidateId === id) {
                    state.selectedCandidateId = null;
                }
                
                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });

            // UPDATE NEGOTIATION VALUES ON SELECT
            html.find('#generosity-select').change(function() {
                refreshUI(html, activePC, state);
            });

            // ROLL NEGOTIATION
            html.find('#roll-negotiation-btn').click(async function(e) {
                e.preventDefault();
                
                const candidate = state.candidates.find(c => c.id === state.selectedCandidateId);
                if (!candidate) return;
                
                const cha = activePC.system.scores?.cha?.value || activePC.system.abilities?.cha?.value || 10;
                const reactionMod = getCharismaModifier(cha);
                const generosityVal = html.find('#generosity-select').val();
                const gen = GENEROSITY_TABLE[generosityVal];
                const reputationPenalty = await getReputationPenalty(activePC);
                
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const roll = d1 + d2;
                
                const modifier = reactionMod + gen.modifier + reputationPenalty;
                const modifiedTotal = roll + modifier;
                
                let result = "";
                let notes = "";
                let isAccepted = false;
                
                if (modifiedTotal <= 2) {
                    result = "Ill Will";
                    notes = "-1 Penalty to all future Retainers rolls (capped at -2).";
                    // Apply Ill Will bad reputation penalty
                    await addReputationEffect(activePC, -1);
                } else if (modifiedTotal >= 3 && modifiedTotal <= 5) {
                    result = "Offer Refused";
                    notes = "Offer refused. Must increase either daily rate or loot share above current offer to roll next day.";
                } else if (modifiedTotal >= 6 && modifiedTotal <= 8) {
                    result = "Roll Again";
                    notes = "Attempt may be made the next day.";
                } else if (modifiedTotal >= 9 && modifiedTotal <= 11) {
                    result = "Offer Accepted";
                    notes = "Deal accepted! They join your retinue.";
                    isAccepted = true;
                } else {
                    result = "Offer Accepted";
                    notes = "Deal accepted! Candidate is eager and begins at +1 Loyalty.";
                    isAccepted = true;
                }

                // Render result locally in dialog
                const resultColor = isAccepted ? "#55ff55" : (modifiedTotal <= 2 ? "#ff5555" : "#ffaa55");
                html.find('#negotiation-result-display').html(`
                    <span style="color: ${resultColor};">Result: ${result} (Modified Roll: ${modifiedTotal})</span><br/>
                    <span style="font-size: 0.85em; font-weight: normal; color: #b0b0b0;">${notes}</span>
                `);
                
                // Save negotiation results in state temporarily so hire-btn knows
                state.negotiationSuccess = isAccepted;
                state.negotiationEager = (modifiedTotal >= 12);
                state.negotiationGenerosity = generosityVal;
                
                if (isAccepted) {
                    html.find('#hire-btn').show();
                } else {
                    html.find('#hire-btn').hide();
                }
                
                // Add to Chat
                const isDemiHuman = ["Dwarf", "Elf", "Halfling", "Gnome", "Wood Elf"].includes(candidate.className);
                const feeStr = calculateFee(generosityVal, candidate.level, isDemiHuman);
                
                ChatMessage.create({
                    content: `
                        <div class="ose-chat-card">
                          <h3>Retainer Hiring Negotiation</h3>
                          <p><strong>Master PC:</strong> ${activePC.name} (CHA ${cha}, Reaction Mod: ${reactionMod >= 0 ? '+' : ''}${reactionMod})</p>
                          <p><strong>Candidate:</strong> ${candidate.className} (Level ${candidate.level}, Demi-Human: ${isDemiHuman ? 'Yes' : 'No'})</p>
                          <p><strong>Offer:</strong> Generosity ${gen.name} (${feeStr}/day, ${gen.lootShare} loot share)</p>
                          <hr/>
                          <p><strong>2d6 Roll:</strong> ${roll} (Dice: ${d1} + ${d2})</p>
                          <p><strong>Modifiers:</strong> CHA reaction mod: ${reactionMod >= 0 ? '+' : ''}${reactionMod}, Generosity mod: ${gen.modifier >= 0 ? '+' : ''}${gen.modifier}, Bad Reputation penalty: ${reputationPenalty}</p>
                          <p><strong>Modified Total:</strong> ${modifiedTotal}</p>
                          <hr/>
                          <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; border-left: 4px solid ${resultColor};">
                             <strong>Result: ${result}</strong><br/>
                             <span style="font-size: 0.9em;">${notes}</span>
                          </div>
                        </div>
                    `
                });

                await savePCState(activePC, state);
                await refreshUI(html, activePC, state);
            });

            // HIRE & CREATE RETAINER ACTOR
            html.find('#hire-btn').click(async function(e) {
                e.preventDefault();
                
                if (!state.negotiationSuccess) return;
                
                const candidate = state.candidates.find(c => c.id === state.selectedCandidateId);
                if (!candidate) return;
                
                const basePCName = activePC.name.split('(')[0].trim();
                const customName = html.find('#retainer-name-input').val()?.trim();
                const defaultName = candidate.className === "Normal Human" ? "Hireling" : "Retainer";
                const rName = customName || defaultName;
                const retainerName = `${rName} (${candidate.className})(${basePCName})`;
                const isDemiHuman = ["Dwarf", "Elf", "Halfling", "Gnome", "Wood Elf"].includes(candidate.className);
                const feeStr = calculateFee(state.negotiationGenerosity, candidate.level, isDemiHuman);
                
                // Roll starting items
                const gearDetails = generateStartingEquipment(candidate.className);
                
                // Roll stats
                const strVal = roll3d6();
                const intVal = roll3d6();
                const wisVal = roll3d6();
                const dexVal = roll3d6();
                const conVal = roll3d6();
                const chaVal = roll3d6();
                const rolledHp = rollHP(candidate.className, candidate.level, conVal);

                // 1. Create Actor
                const actorData = {
                    name: retainerName,
                    type: "character",
                    img: "icons/svg/mystery-man.svg",
                    folder: activePC.folder?.id || activePC.folder || null,
                    system: {
                        details: {
                            class: candidate.className,
                            level: candidate.level
                        },
                        retainer: {
                            enabled: true,
                            wage: feeStr
                        },
                        hp: {
                            value: rolledHp,
                            max: rolledHp
                        },
                        scores: {
                            str: { value: strVal },
                            int: { value: intVal },
                            wis: { value: wisVal },
                            dex: { value: dexVal },
                            con: { value: conVal },
                            cha: { value: chaVal }
                        },
                        abilities: {
                            str: { value: strVal },
                            int: { value: intVal },
                            wis: { value: wisVal },
                            dex: { value: dexVal },
                            con: { value: conVal },
                            cha: { value: chaVal }
                        }
                    },
                    flags: {
                        ose: {
                            paidThroughDate: getGameDateString()
                        }
                    }
                };
                
                let newActor;
                if (typeof Actor !== 'undefined') {
                    newActor = await Actor.create(actorData);
                } else {
                    newActor = {
                        name: retainerName,
                        createEmbeddedDocuments: jest.fn()
                    };
                }
                
                // 2. Create Items
                const itemsToCreate = [
                    { name: "Sling", type: "weapon", system: { quantity: { value: 1 } } },
                    { name: "Backpack", type: "container", system: { quantity: { value: 1 } } },
                    { name: "Small Sack", type: "container", system: { quantity: { value: 1 } } },
                    { name: "Tinderbox", type: "item", system: { quantity: { value: 1 } } },
                    { name: "Torch", type: "item", system: { quantity: { value: gearDetails.torches } } },
                    { name: "Rations (Iron)", type: "item", system: { quantity: { value: gearDetails.rations } } },
                    { name: "GP (Bank)", type: "item", system: { quantity: { value: gearDetails.bankGP } } }
                ];
                
                // Add rolled weapons
                for (const w of gearDetails.weapons) {
                    itemsToCreate.push({ name: w, type: "weapon", system: { quantity: { value: 1 } } });
                }
                // Add rolled gear
                for (const g of gearDetails.gear) {
                    itemsToCreate.push({ name: g, type: "item", system: { quantity: { value: 1 } } });
                }
                
                if (newActor && typeof newActor.createEmbeddedDocuments === 'function') {
                    await newActor.createEmbeddedDocuments("Item", itemsToCreate);
                }

                // 3. Remove candidate from list
                state.candidates = state.candidates.filter(c => c.id !== candidate.id);
                state.selectedCandidateId = null;
                state.negotiationSuccess = false;
                
                await savePCState(activePC, state);
                
                // Chat Message Report
                const loyaltyBase = getBaseLoyalty(activePC.system.scores?.cha?.value || activePC.system.abilities?.cha?.value || 10);
                const loyaltyActual = loyaltyBase + (state.negotiationEager ? 1 : 0);
                const conMod = getAbilityModifier(conVal);
                const conModStr = conMod >= 0 ? `+${conMod}` : `${conMod}`;
                const hdSize = CLASS_HIT_DIE[candidate.className] || 4;
                
                ChatMessage.create({
                    content: `
                        <h3>Retainer Recruited</h3>
                        <p><b>${newActor.name}</b> has been successfully hired by <b>${activePC.name}</b>!</p>
                        <p><b>Contract Details:</b></p>
                        • Class: ${candidate.className}<br/>
                        • Level: ${candidate.level}<br/>
                        • Daily Rate: ${feeStr}<br/>
                        • Base Loyalty: ${loyaltyActual} (Base ${loyaltyBase}${state.negotiationEager ? ' +1 from eager offer' : ''})<br/>
                        <p><b>Rolled Ability Scores:</b></p>
                        • <b>STR:</b> ${strVal} | <b>INT:</b> ${intVal} | <b>WIS:</b> ${wisVal}<br/>
                        • <b>DEX:</b> ${dexVal} | <b>CON:</b> ${conVal} (Mod: ${conModStr}) | <b>CHA:</b> ${chaVal}<br/>
                        • <b>Max HP:</b> ${rolledHp} (Hit Die: ${candidate.level === 0 ? '1d4' : `${candidate.level}d${hdSize}`}, CON Mod: ${conModStr})<br/>
                        <p><b>Starting Inventory Issued:</b></p>
                        • GP Ledger: <b>${gearDetails.bankGP}gp (Bank)</b><br/>
                        • Rations Ledger: <b>${gearDetails.rations} Iron Rations</b> (Issued: ${getGameDateString()})<br/>
                        • Torches: <b>${gearDetails.torches} torches</b><br/>
                        • Basic gear: Sling, Backpack, Small Sack, Tinderbox<br/>
                        • Random Weapons: ${gearDetails.weapons.join(", ")}<br/>
                        • Random Gear: ${gearDetails.gear.join(", ")}
                    `
                });

                ui.notifications.info(`Created Retainer Actor: ${newActor.name}`);
                
                await refreshUI(html, activePC, state);
            });
    });
    dialog.render(true);
}

const CLASS_HIT_DIE = {
    "Cleric": 6,
    "Magic-User": 4,
    "Fighter": 8,
    "Dwarf": 8,
    "Elf": 6,
    "Thief": 4,
    "Halfling": 6,
    "Gnome": 6,
    "Wood Elf": 6,
    "Normal Human": 4
};

function getAbilityModifier(val) {
    if (val <= 3) return -3;
    if (val <= 5) return -2;
    if (val <= 8) return -1;
    if (val <= 12) return 0;
    if (val <= 15) return 1;
    if (val <= 17) return 2;
    return 3;
}

function roll3d6() {
    return (Math.floor(Math.random() * 6) + 1) +
           (Math.floor(Math.random() * 6) + 1) +
           (Math.floor(Math.random() * 6) + 1);
}

function rollHP(className, level, conVal) {
    const hd = CLASS_HIT_DIE[className] || 4;
    const numDice = level === 0 ? 1 : level;
    const conMod = getAbilityModifier(conVal);
    let hp = 0;
    for (let i = 0; i < numDice; i++) {
        const rollVal = Math.floor(Math.random() * hd) + 1;
        hp += Math.max(1, rollVal + conMod);
    }
    return hp;
}

// Roll Helper for Class Table (2d6)
function rollClass(unlockedGnome = false, unlockedWoodElf = false) {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const roll = d1 + d2;
    let className = "";
    
    if (roll === 2) className = "Cleric";
    else if (roll === 3) className = "Magic-User";
    else if (roll >= 4 && roll <= 7) className = "Fighter";
    else if (roll >= 8 && roll <= 9) className = "Thief";
    else if (roll === 10) className = "Halfling";
    else if (roll === 11) {
        if (unlockedGnome) {
            className = Math.random() < 0.5 ? "Dwarf" : "Gnome";
        } else {
            className = "Dwarf";
        }
    }
    else if (roll === 12) {
        if (unlockedWoodElf) {
            className = Math.random() < 0.5 ? "Elf" : "Wood Elf";
        } else {
            className = "Elf";
        }
    }
    return { roll, className };
}
