/**
 * Stat Block Parser for B/X Monster Creation
 * Opens a dialog to paste stat blocks and creates monster actors
 */

// Parsing functions for individual stat attributes
const parseAC = (text) => {
    const acPattern = /(?:AC|ARMOR\s+CLASS)\s*:?\s*(\d+)/i;
    const match = text.match(acPattern);
    return match ? parseInt(match[1]) : null;
};

const parseHP = (text) => {
    // Match patterns like "hp 4", "HP: 4", "hp: 16", "HIT POINTS: 50"
    const hpPattern = /(?:hp|HIT\s+POINTS)\s*:?\s*(\d+)/i;
    const match = text.match(hpPattern);
    return match ? parseInt(match[1]) : null;
};

const parseHD = (text) => {
    // Match patterns like "HD 2+1", "HD 2", "Level O", "Level 0", "Level 1", "HIT DICE: 5 + 3"
    const hdPattern = /(?:HD|Level|HIT\s+DICE)\s*:?\s*(\d+(?:\s*\+\s*\d+)?|O)/i;
    const match = text.match(hdPattern);
    if (!match) return null;

    // Convert "O" or "0" to 0, handle "+1" notation (remove spaces around +)
    let hdValue = match[1].toUpperCase() === 'O' ? '0' : match[1];
    hdValue = hdValue.replace(/\s*\+\s*/, '+');
    return hdValue;
};

const calculateHPFromHD = (hdString) => {
    // Calculate HP from HD using B/X rules
    // Each HD is 1d8 (use average of 4), bonuses are per die
    // Example: "2+1" = 2 dice * 4 + 2 dice * 1 = 10 HP
    if (!hdString) return 1;

    const parts = hdString.split('+');
    const numDice = parseInt(parts[0]);
    const bonusPerDie = parts.length > 1 ? parseInt(parts[1]) : 0;

    // Special case for 0 HD
    if (numDice === 0) return 1;

    // Calculate: (number of dice * 4.5) + (number of dice * bonusPerDie)
    return Math.floor((numDice * 4.5) + (numDice * bonusPerDie));
};

const parseTHAC0 = (text) => {
    const thac0Pattern = /THAC0?\s+(\d+)/i;
    const match = text.match(thac0Pattern);
    return match ? parseInt(match[1]) : null;
};

const calculateTHAC0FromHD = (hdString) => {
    // B/X THAC0 calculation based on HD
    // Normal human (0 HD) = 20, 1 HD = 19, 2 HD = 19, 3 HD = 19, etc.
    // Every +1 HD after 1st reduces THAC0 by 1, approximately
    if (!hdString) return 19;

    const baseHD = parseInt(hdString.split('+')[0]);

    if (baseHD === 0) return 20;
    if (baseHD <= 1) return 19;
    if (baseHD <= 3) return 19;
    if (baseHD <= 5) return 17;
    if (baseHD <= 7) return 15;
    if (baseHD <= 9) return 13;
    return 11; // 10+ HD
};

const parseAttacks = (text) => {
    // Match patterns like "#AT 1 or 2", "#AT 1", "Att: 1", "Attacks: 2", "NO. OF ATTACKS: 1"
    const attackPattern = /(?:#?AT(?:tacks?)?|NO\.\s+OF\s+ATTACKS)\s*:?\s*(\d+)(?:\s+or\s+(\d+))?/i;
    const match = text.match(attackPattern);
    if (!match) return null;

    // Return the higher number if "or" is present
    if (match[2]) {
        return Math.max(parseInt(match[1]), parseInt(match[2]));
    }
    return parseInt(match[1]);
};

const parseDamage = (text) => {
    // Match patterns like "D 1-6 (spear)", "Dmg: 1-6/1-6", "D: 2-8", "DAMAGE/ATTACK: 1-6"
    const damagePattern = /(?:D(?:mg)?(?:amage)?(?:\/ATTACK)?)\s*:?\s*([\d\-\/]+(?:\s*\([^)]+\))?(?:\s+or\s+[\d\-\/]+(?:\s*\([^)]+\))?)*)/i;
    const match = text.match(damagePattern);
    return match ? match[1].trim() : null;
};

const parseXP = (text) => {
    // Match patterns like "XP18", "XP 100", "XP: 50"
    const xpPattern = /XP\s*:?\s*(\d+)/i;
    const match = text.match(xpPattern);
    return match ? parseInt(match[1]) : null;
};

const parseAlignment = (text) => {
    // Match patterns like "AL N", "AL: LG", "AL NE", "ALIGNMENT: Lawful evil"
    // Use \b to ensure we match whole words (avoids matching "AL" in "SPECIAL")
    const alignmentPattern = /\b(?:AL(?:ignment)?)\s*:?\s*([^\r\n;]+)/i;
    const match = text.match(alignmentPattern);
    if (!match) return null;

    const value = match[1].trim();

    // If it's a full name (longer than 2 chars), return it capitalized
    if (value.length > 2) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    // Convert abbreviation to full name
    const abbreviation = value.toUpperCase();
    const alignmentMap = {
        'L': 'Lawful',
        'N': 'Neutral',
        'C': 'Chaotic',
        'LG': 'Lawful Good',
        'NG': 'Neutral Good',
        'CG': 'Chaotic Good',
        'LN': 'Lawful Neutral',
        'TN': 'True Neutral',
        'CN': 'Chaotic Neutral',
        'LE': 'Lawful Evil',
        'NE': 'Neutral Evil',
        'CE': 'Chaotic Evil'
    };

    return alignmentMap[abbreviation] || value;
};

const parseMorale = (text) => {
    // Match patterns like "ML 8", "ML: 12", "ML9"
    const moralePattern = /ML\s*:?\s*(\d+)/i;
    const match = text.match(moralePattern);
    return match ? parseInt(match[1]) : null;
};

const calculateMoraleFromHD = (hdString, name = "") => {
    // Check for common undead names first
    const undeadKeywords = [
        "skeleton", "zombie", "ghoul", "ghast", "wight", "wraith",
        "mummy", "spectre", "vampire", "ghost", "shadow", "lich"
    ];

    if (name && undeadKeywords.some(keyword => name.toLowerCase().includes(keyword))) {
        return 12;
    }

    // Calculate Morale from HD using AD&D 1e rules mapped to B/X (2-12)
    // Base 50% + 5%/HD above 1 + 1%/hp bonus
    if (!hdString) return 7; // Default to 7 (50%) if no HD

    const parts = hdString.split('+');
    const numDice = parseInt(parts[0]);
    const bonusHP = parts.length > 1 ? parseInt(parts[1]) : 0;

    // Base 50%
    let percentage = 50;

    // +5% per HD above 1
    if (numDice > 1) {
        percentage += (numDice - 1) * 5;
    }

    // +1% per hit point above hit dice (the plus part)
    percentage += bonusHP;

    // Map percentage to 2-12 scale
    // 50% -> 7, 100% -> 12, 0% -> 2
    let morale = 2 + Math.round(percentage / 10);

    // Clamp between 2 and 12
    return Math.min(12, Math.max(2, morale));
};

const parseTreasureType = (text) => {
    // Match patterns like "TT A", "TT: B", "TT C, D", "TREASURE TYPE: E", "TREASURE TYPE: Nil"
    const treasurePattern = /(?:TT|TREASURE\s+TYPE)\s*:?\s*([^\r\n;]+)/i;
    const match = text.match(treasurePattern);
    return match ? match[1].trim() : null;
};

const parseMovement = (text) => {
    // Match patterns like "MV 12", "MV: 9", "MV6", "MOVE: 12”/24”"
    // Value is in inches and needs to be multiplied by 10
    const movementPattern = /(?:MV|MOVE)\s*:?\s*(\d+)/i;
    const match = text.match(movementPattern);
    return match ? parseInt(match[1]) * 10 : null;
};

// Create the dialog
new Dialog({
    title: "Create Monster from Stat Block",
    content: `
    <form>
      <div class="form-group">
        <label>Monster Name</label>
        <input type="text" id="monster-name" placeholder="Enter monster name" style="width: 100%;" />
      </div>
      <div class="form-group">
        <label>Stat Block</label>
        <textarea id="stat-block" rows="8" placeholder="Paste B/X stat block here..." style="width: 100%; font-family: monospace;"></textarea>
      </div>
      <p style="font-size: 0.9em; color: #666;">
        <strong>Example:</strong><br/>
        AC 8 (leather); MV 12; AL N; Level O; hp 4; #AT 1 or 2; D 1-6 (spear) or 1-6/1-6 (shortbow); ML 8; TT A; XP18
      </p>
    </form>
  `,
    buttons: {
        create: {
            label: "Create Monster",
            callback: async (html) => {
                const name = html.find('#monster-name')[0].value.trim();
                const statBlock = html.find('#stat-block')[0].value.trim();

                if (!name) {
                    ui.notifications.error("Please enter a monster name.");
                    return;
                }

                if (!statBlock) {
                    ui.notifications.error("Please paste a stat block.");
                    return;
                }
                // Parse the stat block
                const ac = parseAC(statBlock);
                const hd = parseHD(statBlock);
                let hp = parseHP(statBlock);
                let thac0 = parseTHAC0(statBlock);
                const attacks = parseAttacks(statBlock);
                const damage = parseDamage(statBlock);
                const xp = parseXP(statBlock);
                const alignment = parseAlignment(statBlock);
                let morale = parseMorale(statBlock);
                const treasureType = parseTreasureType(statBlock);
                const movement = parseMovement(statBlock);

                // Calculate HP from HD if not present
                if (hp === null) {
                    hp = calculateHPFromHD(hd);
                }

                // Calculate THAC0 if not present
                if (thac0 === null) {
                    thac0 = calculateTHAC0FromHD(hd);
                }

                // Calculate Morale if not present
                if (morale === null) {
                    morale = calculateMoraleFromHD(hd, name);
                }

                // Build actor data
                const actorData = {
                    name: name,
                    type: "monster",
                    system: {
                        hp: {
                            value: hp || 1,
                            max: hp || 1,
                            hd: hd || "1"
                        },
                        ac: {
                            value: ac || 9
                        },
                        thac0: {
                            value: thac0 || 19
                        },
                        movement: {
                            base: movement || 0
                        },
                        details: {
                            xp: xp || 0,
                            alignment: alignment || "",
                            morale: morale || 0,
                            treasure: {
                                type: treasureType || ""
                            }
                        }
                    }
                };

                // Store attacks and damage in actor data (may need adjustment based on OSE schema)
                if (attacks !== null) {
                    actorData.system.attacks = attacks;
                }
                if (damage) {
                    actorData.system.damage = damage;
                }

                try {
                    const actor = await Actor.create(actorData);
                    ui.notifications.info(`Monster "${name}" created successfully!`);

                    // Log parsed values for debugging
                    console.log("Created monster with parsed values:", {
                        ac, hp, hd, thac0, attacks, damage, xp, alignment, morale, treasureType, movement
                    });
                } catch (error) {
                    ui.notifications.error(`Failed to create monster: ${error.message}`);
                    console.error("Monster creation error:", error);
                }
            }
        },
        cancel: {
            label: "Cancel"
        }
    },
    default: "create"
}).render(true);
