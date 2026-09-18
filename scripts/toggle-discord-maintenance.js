/**
 * Toggle Foundry Discord Status Bot Maintenance Mode
 *
 * Flips the Discord Bot status between Online (Green) and Maintenance Mode (Yellow / Idle).
 * When active, Discord shows: 'Playing 🔨 Maintenance: GM Prepping'
 */
(async () => {
  const BOT_API_URL = 'http://127.0.0.1:30099';

  try {
    const response = await fetch(`${BOT_API_URL}/maintenance/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const isMaint = data.maintenance?.enabled;
    const reason = data.maintenance?.reason || 'GM Prepping';

    if (isMaint) {
      ui.notifications.warn(`Discord Status: Maintenance ON (Idle / Yellow - ${reason})`);
    } else {
      ui.notifications.info(`Discord Status: Maintenance OFF (Online & Active / Green)`);
    }
  } catch (err) {
    ui.notifications.error(`Failed to reach Foundry Status Bot: ${err.message}`);
    console.error('Foundry Status Bot Error:', err);
  }
})();
