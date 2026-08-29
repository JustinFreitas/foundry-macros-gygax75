/**
 * @jest-environment jsdom
 */
const {
    buildProcedureModel,
    countActionable,
    escapeHtml,
    renderProcedureHtml,
    bindProcedureHandlers
} = require("../scripts/lib/procedure-runner.js");

describe("procedure-runner: buildProcedureModel", () => {
    test("indexes and classifies each step kind", () => {
        const model = buildProcedureModel("Test", [
            { section: "Setup" },
            { macro: "Speed Report" },
            { manual: "Caller selects destination" },
            { note: "OSR Helper drives the clock" }
        ]);
        expect(model.title).toBe("Test");
        expect(model.steps.map((s) => s.kind)).toEqual(["section", "macro", "manual", "note"]);
        expect(model.steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
        expect(model.steps[1].macro).toBe("Speed Report");
        expect(model.steps[1].label).toBe("Speed Report");
    });

    test("honours a custom macro label and the optional flag", () => {
        const model = buildProcedureModel("T", [
            { macro: "Party Room Trap Check", label: "Room Traps", optional: true }
        ]);
        expect(model.steps[0].label).toBe("Room Traps");
        expect(model.steps[0].optional).toBe(true);
    });

    test("throws on an unrecognised step shape", () => {
        expect(() => buildProcedureModel("T", [{ bogus: "x" }])).toThrow(/no recognised key/);
    });

    test("throws when steps is not an array", () => {
        expect(() => buildProcedureModel("T", null)).toThrow(/must be an array/);
    });
});

describe("procedure-runner: countActionable", () => {
    test("counts only macro and manual rows", () => {
        const model = buildProcedureModel("T", [
            { section: "A" },
            { macro: "X" },
            { manual: "Y" },
            { note: "Z" },
            { macro: "W" }
        ]);
        expect(countActionable(model)).toBe(3);
    });
});

describe("procedure-runner: escapeHtml", () => {
    test("escapes angle brackets, ampersands and quotes", () => {
        expect(escapeHtml('<b>"a & b"</b>')).toBe("&lt;b&gt;&quot;a &amp; b&quot;&lt;/b&gt;");
    });
});

describe("procedure-runner: renderProcedureHtml", () => {
    test("renders a button for macro steps and a checkbox for manual steps", () => {
        const model = buildProcedureModel("T", [
            { macro: "Speed Report" },
            { manual: "Narrate RP" }
        ]);
        const html = renderProcedureHtml(model);
        expect(html).toContain('class="procedure-macro"');
        expect(html).toContain('data-macro="Speed Report"');
        expect(html).toContain('class="procedure-manual"');
        expect(html).toContain("0 / 2 done");
    });

    test("the form is given a min-width and full width so rows fill the dialog", () => {
        const html = renderProcedureHtml(buildProcedureModel("T", [{ manual: "x" }]));
        expect(html).toMatch(/class="procedure-runner"[^>]*min-width/);
        expect(html).toContain("width:100%");
    });

    test("disables a macro button flagged optional", () => {
        const model = buildProcedureModel("T", [{ macro: "Missing One", optional: true }]);
        const html = renderProcedureHtml(model);
        expect(html).toContain("disabled");
        expect(html).toContain("(unavailable)");
    });
});

describe("procedure-runner: bindProcedureHandlers", () => {
    function mount(model) {
        const root = document.createElement("div");
        root.innerHTML = renderProcedureHtml(model);
        document.body.appendChild(root);
        return root;
    }

    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("clicking a macro button runs it and check-marks the row", async () => {
        const model = buildProcedureModel("T", [{ macro: "Speed Report" }]);
        const root = mount(model);
        const runMacro = jest.fn().mockResolvedValue(undefined);
        bindProcedureHandlers(root, model, runMacro);

        root.querySelector("button.procedure-macro").click();
        // allow the async click handler to settle
        await new Promise((r) => setTimeout(r, 0));

        expect(runMacro).toHaveBeenCalledWith("Speed Report");
        expect(root.querySelector('.procedure-check[data-index="0"]').textContent).toBe("✅");
        expect(root.querySelector(".procedure-progress").textContent).toBe("1 / 1 done");
    });

    test("a failing macro does not mark the row done", async () => {
        const model = buildProcedureModel("T", [{ macro: "Boom" }]);
        const root = mount(model);
        const runMacro = jest.fn().mockRejectedValue(new Error("nope"));
        global.ui = { notifications: { error: jest.fn() } };
        bindProcedureHandlers(root, model, runMacro);

        root.querySelector("button.procedure-macro").click();
        await new Promise((r) => setTimeout(r, 0));

        expect(root.querySelector('.procedure-check[data-index="0"]').textContent).toBe("");
        expect(root.querySelector(".procedure-progress").textContent).toBe("0 / 1 done");
        delete global.ui;
    });

    test("ticking and un-ticking a manual checkbox updates progress", () => {
        const model = buildProcedureModel("T", [{ manual: "Caller selects destination" }]);
        const root = mount(model);
        bindProcedureHandlers(root, model, jest.fn());

        const box = root.querySelector("input.procedure-manual");
        box.checked = true;
        box.dispatchEvent(new Event("change"));
        expect(root.querySelector(".procedure-progress").textContent).toBe("1 / 1 done");

        box.checked = false;
        box.dispatchEvent(new Event("change"));
        expect(root.querySelector(".procedure-progress").textContent).toBe("0 / 1 done");
        expect(root.querySelector('.procedure-check[data-index="0"]').textContent).toBe("");
    });
});
