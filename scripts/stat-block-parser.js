/**
 * Stat Block Parser for B/X Monster Creation
 * Opens a dialog to paste stat blocks and creates monster actors
 */

// Parsing functions for individual stat attributes
const parseAC = (text) => {
    const acPattern = /AC\s+(\d+)/i;
    const match = text.match(acPattern);
    return match ? parseInt(match[1]) : null;
};

const parseHP = (text) => {
    const hpPattern = /hp\s+(\d+)/i;
    const match = text.match(hpPattern);
    return match ? parseInt(match[1]) : null;
};

const parseHD = (text) => {
    // Match patterns like "HD 2+1", "HD 2", "Level O", "Level 0", "Level 1"
    const hdPattern = /(?:HD|Level)\s+(\d+(?:\+\d+)?|O)/i;
    const match = text.match(hdPattern);
    if (!match) return null;

    // Convert "O" or "0" to 0, handle "+1" notation
    const hdValue = match[1].toUpperCase() === 'O' ? '0' : match[1];
    return hdValue;
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
    // Match patterns like "#AT 1 or 2", "#AT 1", "Att: 1", "Attacks: 2"
    const attackPattern = /#?AT(?:tacks?)?\s*:?\s*(\d+)(?:\s+or\s+(\d+))?/i;
    const match = text.match(attackPattern);
    if (!match) return null;

    // Return the higher number if "or" is present
    if (match[2]) {
        return Math.max(parseInt(match[1]), parseInt(match[2]));
    }
    return parseInt(match[1]);
};

const parseDamage = (text) => {
    // Match patterns like "D 1-6 (spear)", "Dmg: 1-6/1-6", "D: 2-8"
    const damagePattern = /D(?:mg)?(?:amage)?\s*:?\s*([\d\-\/]+(?:\s*\([^)]+\))?(?:\s+or\s+[\d\-\/]+(?:\s*\([^)]+\))?)*)/i;
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
    // Match patterns like "AL N", "AL: LG", "AL NE"
    const alignmentPattern = /AL\s*:?\s*([A-Z]{1,2})/i;
    const match = text.match(alignmentPattern);
    if (!match) return null;

    // Convert abbreviation to full name
    const abbreviation = match[1].toUpperCase();
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

    return alignmentMap[abbreviation] || abbreviation;
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
        AC 8 (leather); AL N; Level O; hp 4; #AT 1 or 2; D 1-6 (spear) or 1-6/1-6 (shortbow); XP18
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
                const hp = parseHP(statBlock);
                const hd = parseHD(statBlock);
                let thac0 = parseTHAC0(statBlock);
                const attacks = parseAttacks(statBlock);
                const damage = parseDamage(statBlock);
                const xp = parseXP(statBlock);
                const alignment = parseAlignment(statBlock);

                // Calculate THAC0 if not present
                if (thac0 === null) {
                    thac0 = calculateTHAC0FromHD(hd);
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
                        details: {
                            xp: xp || 0,
                            alignment: alignment || ""
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
                        ac, hp, hd, thac0, attacks, damage, xp, alignment
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
