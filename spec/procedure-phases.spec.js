/**
 * @jest-environment jsdom
 *
 * Each phase-runner macro is just a declarative `steps` list handed to
 * runProcedure. We load the macro source, stub runProcedure to capture the steps,
 * and assert the list is well-formed and that every NON-optional macro row names a
 * real world macro (so a rename can't silently break a procedure). The set of
 * world macro names is read from the packed JSON exports in _qe-macro-sync.
 */
const fs = require("fs");
const path = require("path");

const SCRIPTS = path.resolve(__dirname, "../scripts");
const UNPACKED = path.resolve(__dirname, "../../_qe-macro-sync/unpacked");

// The packed world macro names (source of truth for what runProcedure can call).
const worldMacroNames = new Set(
    fs
        .readdirSync(UNPACKED)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(UNPACKED, f), "utf8")).name)
);

// New macros that this change packs alongside the runners — treat as available.
["Spiked Door Check", "Party Room Trap Check"].forEach((n) => worldMacroNames.add(n));

// Run a phase macro's body with runProcedure stubbed; return the captured steps.
function loadSteps(file) {
    const src = fs.readFileSync(path.join(SCRIPTS, file), "utf8");
    // The macro ends with `await runProcedure(title, steps);` then the inlined
    // shared region (which redefines runProcedure). Strip the shared region and
    // the await so we can evaluate just the declaration + capture call.
    const beforeShared = src.split("// <<< BEGIN SHARED")[0];
    let captured = null;
    const runProcedure = (title, steps) => {
        captured = { title, steps };
    };
    const body = beforeShared.replace(/\bawait\s+runProcedure/g, "runProcedure");
    // eslint-disable-next-line no-new-func
    new Function("runProcedure", body)(runProcedure);
    return captured;
}

const PHASE_FILES = [
    "procedure-departure.js",
    "procedure-dungeon-turn.js",
    "procedure-return.js",
    "procedure-expedition-return.js"
];

describe.each(PHASE_FILES)("phase runner: %s", (file) => {
    const { title, steps } = loadSteps(file);

    test("has a non-empty title and steps", () => {
        expect(typeof title).toBe("string");
        expect(title.length).toBeGreaterThan(0);
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);
    });

    test("every step has exactly one recognised kind key", () => {
        const KINDS = ["macro", "manual", "section", "note"];
        for (const step of steps) {
            const present = KINDS.filter((k) =>
                Object.prototype.hasOwnProperty.call(step, k)
            );
            expect(present).toHaveLength(1);
        }
    });

    test("every non-optional macro row names a real world macro", () => {
        const missing = steps
            .filter((s) => s.macro && !s.optional)
            .map((s) => s.macro)
            .filter((name) => !worldMacroNames.has(name));
        expect(missing).toEqual([]);
    });

    test("optional macro rows are exactly the not-yet-packed names", () => {
        // optional should only be used to tolerate a name that may be unpacked;
        // if it names a macro that DOES exist, drop the optional flag.
        const wronglyOptional = steps
            .filter((s) => s.macro && s.optional && worldMacroNames.has(s.macro))
            .map((s) => s.macro);
        // After this change packs them, these become available — so this guards
        // against leaving a stale optional flag once they're in the world set.
        expect(wronglyOptional).toEqual([]);
    });
});

describe("phase runners collectively", () => {
    test("the runner is inlined (shared markers present) in every phase file", () => {
        for (const file of PHASE_FILES) {
            const src = fs.readFileSync(path.join(SCRIPTS, file), "utf8");
            expect(src).toContain("// <<< BEGIN SHARED: procedure-runner >>>");
            expect(src).toContain("function runProcedure");
        }
    });
});
