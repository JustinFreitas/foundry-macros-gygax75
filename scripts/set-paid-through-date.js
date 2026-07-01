/*
    This script sets the 'paidThroughDate' flag on the actors of the selected tokens.
    It prompts the user for a date string via a dialog and then applies that date to the selected actors.
    A report is sent to the chat with the results.
*/

// Parse a user-entered M/D/YYYY (or M/D/YY) date string explicitly rather than
// relying on the `Date` constructor, whose handling of non-ISO strings (and
// especially 2-digit years) is implementation-defined. Two-digit years map to
// 2000-2099. Returns a Date at local midnight, or null if the string isn't a
// valid M/D/Y date.
function parseMDYDate(dateString) {
    const match = String(dateString).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
    if (!match) return null;

    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (match[3].length <= 2) year += 2000;

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    // Reject overflow (e.g. 2/30 rolling into March).
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

const selectedActors = canvas.tokens.controlled.map(token => token.actor);

if (!selectedActors.length) {
    ui.notifications.warn("No tokens selected.");
} else {
    const actorInfo = selectedActors.map(actor => {
        const paidThrough = actor.getFlag('ose', 'paidThroughDate') || 'Not Set';
        return `${actor.name} (${paidThrough})`;
    }).join('<br>');

    const { DialogV2 } = foundry.applications.api;
    DialogV2.wait({
        window: { title: "Set Paid Through Date" },
        content: `
    <form>
      <div>${actorInfo}</div>
      <hr>
      <div class="form-group">
        <label>Date</label>
        <input type="text" id="paid-through-date" placeholder="Enter date string (MM/DD/YYYY)"></input>
      </div>
    </form>
  `,
        buttons: [
            {
                action: "ok",
                label: "Set Date",
                default: true,
                callback: async (event, button, dialog) => {
                    const html = $(dialog.element);
                    const dateString = html.find('#paid-through-date')[0].value;
                    if (!dateString) {
                        ui.notifications.error("Please enter a date.");
                        return;
                    }

                    const date = parseMDYDate(dateString);
                    if (!date) {
                        ui.notifications.error("Invalid date format. Please enter a date as MM/DD/YYYY.");
                        return;
                    }
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const year = date.getFullYear();
                    const formattedDate = `${month}/${day}/${year}`;

                    const chatLogs = ['<h4>Paid Through Date Report</h4>'];

                    for (const actor of selectedActors) {
                        await actor.setFlag('ose', 'paidThroughDate', formattedDate);
                        chatLogs.push(`<p>Set 'paidThroughDate' for <strong>${actor.name}</strong> to <strong>${formattedDate}</strong>.</p>`);
                    }

                    ChatMessage.create({
                        content: chatLogs.join(''),
                    });
                }
            },
            {
                action: "cancel",
                label: "Cancel"
            }
        ]
    });
}
