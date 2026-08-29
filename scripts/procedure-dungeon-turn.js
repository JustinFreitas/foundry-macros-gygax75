// Procedure: Dungeon Turn
//
// Interactive checklist for the repeating "Dungeon Turn" section of the DM
// Procedures runbook. Actual time advancement is left to OSR Helper /
// SimpleCalendar — the End-of-Turn "advance 10 mins" row is a manual reminder.
//
// The procedure-runner helper is INLINED below between the SHARED markers and is
// kept in sync from scripts/lib/procedure-runner.js by scripts/lib/sync-shared.js.

const steps = [
    { section: "First Turn in Dungeon (skip after the first turn)" },
    { macro: "Ration Spoiling", label: "Spoil rations" },
    { manual: "Prompt light source; set party-token torch/oil quantity." },
    { manual: "Verify OSR Helper wandering-monster table." },

    { section: "Check Effects" },
    { manual: "End all expired effects (spells, status, light relight/expire)." },
    { macro: "Light Turns Remaining", label: "Report light turns remaining" },

    { section: "Wandering Monsters" },
    { macro: "Wandering Monster Check", label: "Roll wandering monster check" },
    { manual: "Decide / roll distance; place monster and track location." },

    { section: "Player Turn" },
    { manual: "Obtain desired course of action from the Caller." },
    { manual: "Room descriptions / listen checks / stuck & secret doors." },
    { macro: "Party Secret Doors Check", label: "Party secret-door check" },
    { macro: "Party Room Trap Check", label: "Party room-trap check" },
    { manual: "Trap trigger checks; resolve light sources." },

    { section: "Encounter / Combat (ends the turn)" },
    { manual: "Decide monster actions; update token distances; upkeep morale." },
    { manual: "Add treasure to party loot; update dungeon loot tables." },
    { macro: "Treasure Stow", label: "Distribute treasure (stow)" },

    { section: "End of Turn" },
    { macro: "Spiked Door Check", label: "Check spiked door failure (1-in-6)" },
    { manual: "Remove avoided wandering monsters." },
    { manual: "Advance Dungeon Turn 10 mins (OSR Helper / Simple Calendar)." }
];

await runProcedure("Dungeon Turn", steps);

// <<< BEGIN SHARED: procedure-runner >>>
/*
 * procedure-runner — a tiny orchestration helper for the DM session procedures.
 *
 * Given an ordered list of STEPS it renders ONE interactive checklist dialog
 * (DialogV2 on v14, falling back to Dialog on v13). It does not duplicate any
 * game logic: macro steps simply call the existing world macros by name.
 *
 * A step is one of:
 *   { macro: "Speed Report" }                  -> a button that runs the named
 *                                                 world macro, then check-marks
 *                                                 the row (dialog stays open).
 *   { macro: "Speed Report", label: "Speed" }  -> same, with a custom button label.
 *   { manual: "Caller selects destination" }   -> a checkbox the DM ticks.
 *   { section: "End of Turn" }                  -> a bold sub-heading.
 *   { note: "OSR Helper drives the clock" }     -> an italic informational line.
 *
 * `buildProcedureModel(title, steps)` is pure (no DOM / no Foundry) so it can be
 * unit-tested; `runProcedure(title, steps)` renders it. Both are exported when
 * the file is loaded under Node (the Jest spec require()s it); inside Foundry the
 * macro just calls runProcedure(...).
 */

// Normalise a raw step list into a validated, indexed model. Throws on an
// unrecognised step shape so a typo in a procedure surfaces immediately instead
// of silently dropping a step.
function buildProcedureModel(title, steps) {
    if (!Array.isArray(steps)) {
        throw new Error("procedure-runner: steps must be an array");
    }
    const KINDS = ["macro", "manual", "section", "note"];
    const model = steps.map((step, index) => {
        const kind = KINDS.find((k) => Object.prototype.hasOwnProperty.call(step, k));
        if (!kind) {
            throw new Error(
                `procedure-runner: step ${index} has no recognised key (one of ${KINDS.join(", ")})`
            );
        }
        const entry = { index, kind, text: String(step[kind]) };
        if (kind === "macro") {
            entry.macro = entry.text;
            entry.label = step.label ? String(step.label) : entry.text;
            // optional flag: this macro is documented but not yet packed in the
            // world; the runner renders it disabled rather than throwing at click.
            entry.optional = step.optional === true;
        }
        return entry;
    });
    return { title: String(title), steps: model };
}

// Count the actionable rows (macro + manual) so the dialog can show progress.
function countActionable(model) {
    return model.steps.filter((s) => s.kind === "macro" || s.kind === "manual").length;
}

// Escape text destined for innerHTML so a stray '<' in a step label can't break
// the dialog markup.
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Build the dialog body HTML for a model. Pure string work so it is unit-testable.
function renderProcedureHtml(model) {
    const rows = model.steps.map((s) => {
        if (s.kind === "section") {
            return `<h3 class="procedure-section" style="margin:8px 0 2px;">${escapeHtml(s.text)}</h3>`;
        }
        if (s.kind === "note") {
            return `<p class="procedure-note" style="margin:2px 0; font-style:italic; opacity:0.8;">${escapeHtml(s.text)}</p>`;
        }
        if (s.kind === "manual") {
            return `
                <div class="procedure-row" data-index="${s.index}" style="display:flex; align-items:center; gap:6px; margin:0; min-height:0; width:100%;">
                    <input type="checkbox" class="procedure-manual" data-index="${s.index}" style="flex:0 0 auto; margin:0;" />
                    <label style="flex:1 1 auto; margin:0; line-height:1.4;">${escapeHtml(s.text)}</label>
                    <span class="procedure-check" data-index="${s.index}" style="flex:0 0 1.2em; text-align:center;"></span>
                </div>`;
        }
        // macro
        const disabled = s.optional ? "disabled title='Not packed in this world yet'" : "";
        const note = s.optional ? ` <em style="opacity:0.7;">(unavailable)</em>` : "";
        return `
            <div class="procedure-row" data-index="${s.index}" style="display:flex; align-items:center; gap:6px; margin:1px 0; min-height:0; width:100%;">
                <button type="button" class="procedure-macro" data-index="${s.index}" data-macro="${escapeHtml(s.macro)}" style="flex:1 1 auto; text-align:left;" ${disabled}>${escapeHtml(s.label)}</button>${note}
                <span class="procedure-check" data-index="${s.index}" style="flex:0 0 1.2em; text-align:center;"></span>
            </div>`;
    });
    const total = countActionable(model);
    return `
        <form class="procedure-runner" style="width:100%; min-width:520px; max-height:70vh; overflow-y:auto; box-sizing:border-box; padding:8px 4px 4px;">
            <p class="procedure-progress" style="margin:0 0 6px; font-weight:bold;">0 / ${total} done</p>
            ${rows.join("\n")}
        </form>`;
}

// Wire click/change handlers onto an already-rendered root element. `runMacro`
// is injected (defaults to the Foundry lookup) so the spec can drive it without
// a live game. Marks a row done by writing a check glyph into its .procedure-check.
function bindProcedureHandlers(root, model, runMacro) {
    const done = new Set();
    const progress = root.querySelector(".procedure-progress");
    const total = countActionable(model);

    const markDone = (index) => {
        done.add(index);
        const cell = root.querySelector(`.procedure-check[data-index="${index}"]`);
        if (cell) cell.textContent = "✅"; // ✅
        if (progress) progress.textContent = `${done.size} / ${total} done`;
    };

    root.querySelectorAll("button.procedure-macro").forEach((btn) => {
        btn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const index = Number(btn.dataset.index);
            const name = btn.dataset.macro;
            try {
                await runMacro(name);
                markDone(index);
            } catch (err) {
                console.error(`procedure-runner: macro "${name}" failed`, err);
                if (typeof ui !== "undefined") {
                    ui.notifications?.error(`Macro "${name}" failed: ${err.message}`);
                }
            }
        });
    });

    root.querySelectorAll("input.procedure-manual").forEach((box) => {
        box.addEventListener("change", () => {
            const index = Number(box.dataset.index);
            if (box.checked) markDone(index);
            else {
                done.delete(index);
                const cell = root.querySelector(`.procedure-check[data-index="${index}"]`);
                if (cell) cell.textContent = "";
                if (progress) progress.textContent = `${done.size} / ${total} done`;
            }
        });
    });

    return { done };
}

// Look up and execute a world macro by name. Throws if it is missing so the
// caller can surface a clear error.
async function executeWorldMacro(name) {
    const macro = game.macros.getName(name);
    if (!macro) throw new Error(`No macro named "${name}" in this world`);
    return macro.execute();
}

// Render the interactive checklist. Returns the dialog result (resolves when the
// DM closes it). Safe to call from a macro body.
async function runProcedure(title, steps) {
    const model = buildProcedureModel(title, steps);
    const content = renderProcedureHtml(model);
    const DialogV2 = foundry.applications?.api?.DialogV2;

    const onRender = (rootEl) => bindProcedureHandlers(rootEl, model, executeWorldMacro);

    if (DialogV2) {
        return DialogV2.wait({
            window: { title: model.title },
            position: { width: 560 },
            content,
            buttons: [{ action: "close", label: "Done", default: true }],
            rejectClose: false,
            render: (_event, dialog) => {
                const rootEl = dialog.element ?? dialog;
                onRender(rootEl);
            }
        });
    }

    return new Promise((resolve) => {
        new Dialog({
            title: model.title,
            content,
            buttons: { close: { label: "Done" } },
            default: "close",
            render: (html) => onRender(html instanceof jQuery ? html[0] : html),
            close: () => resolve(true)
        }).render(true);
    });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        buildProcedureModel,
        countActionable,
        escapeHtml,
        renderProcedureHtml,
        bindProcedureHandlers,
        executeWorldMacro,
        runProcedure
    };
}
// <<< END SHARED: procedure-runner >>>
