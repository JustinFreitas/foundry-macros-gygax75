/*
    This script sets the 'paidThroughDate' flag on the actors of the selected tokens.
    It prompts the user for a date string via a dialog and then applies that date to the selected actors.
    A report is sent to the chat with the results.
*/

const selectedActors = canvas.tokens.controlled.map(token => token.actor);

if (!selectedActors.length) {
    ui.notifications.warn("No tokens selected.");
} else {
    const actorInfo = selectedActors.map(actor => {
        const paidThrough = actor.getFlag('ose', 'paidThroughDate') || 'Not Set';
        return `${actor.name} (${paidThrough})`;
    }).join('<br>');

    new Dialog({
        title: "Set Paid Through Date",
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
        buttons: {
            ok: {
                label: "Set Date",
                callback: async (html) => {
                    const dateString = html.find('#paid-through-date')[0].value;
                    if (!dateString) {
                        ui.notifications.error("Please enter a date.");
                        return;
                    }

                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        ui.notifications.error("Invalid date format.");
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
            cancel: {
                label: "Cancel"
            }
        },
        default: "ok"
    }).render(true);
}
