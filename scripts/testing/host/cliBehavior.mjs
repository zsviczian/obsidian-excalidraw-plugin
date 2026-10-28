/** Actual plugin CLI commands, transported by the Node driver with the local vault identity. */
export async function exerciseCLIBehavior(c, env, rows) {
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      const { p, check } = env;
      let view = await env.openDrawing(row.id);
      const command = (name, request) =>
        c.requestHost("behavior-plugin-cli", {
          command: name,
          request: { apiVersion: 1, ...request },
        });
      const ok = (result) => {
        check(result.ok === true, JSON.stringify(result));
        return result;
      };
      const path = view.file.path,
        live = ok(
          await command("read", { path, source: "live", detail: "elements" }),
        ).data;
      const target = live.elements[0];
      check(
        target && live.viewId,
        "CLI did not identify the owned live target",
      );
      const other = await env.create(
        "CLI-other-target.excalidraw.md",
        await app.vault.read(view.file),
      );
      const otherLeaf = app.workspace.getLeaf("tab");
      env.owned.add(otherLeaf);
      await otherLeaf.openFile(other);
      await env.ready(otherLeaf);
      app.workspace.setActiveLeaf(otherLeaf, { focus: true });
      const unchanged = JSON.stringify(otherLeaf.view.getViewElements());
      const requestId = "behavior-" + crypto.randomUUID();
      const applied = ok(
        await command("apply", {
          requestId,
          path,
          view: live.viewId,
          expectedRevision: live.revision,
          operations: [
            {
              op: "update",
              id: target.id,
              set: { x: target.x + 13, opacity: 0, locked: false },
            },
          ],
        }),
      );
      check(
        applied.persistence === "saved",
        "CLI apply did not acknowledge durable persistence",
      );
      check(
        JSON.stringify(otherLeaf.view.getViewElements()) === unchanged,
        "CLI changed the active drawing instead of its explicit target",
      );
      const disk = ok(
        await command("read", { path, source: "disk", detail: "elements" }),
      ).data.elements.find((el) => el.id === target.id);
      check(
        disk.x === target.x + 13 && disk.opacity === 0 && disk.locked === false,
        "CLI discarded explicit zero/false values or changed the wrong physical file",
      );
      const current = ok(
        await command("read", {
          path,
          view: live.viewId,
          source: "live",
          detail: "elements",
        }),
      ).data;
      const before = await app.vault.read(view.file);
      const invalid = await command("apply", {
        requestId: "behavior-invalid-" + crypto.randomUUID(),
        path,
        view: live.viewId,
        expectedRevision: current.revision,
        operations: [
          { op: "update", id: target.id, set: { x: 99999 } },
          { op: "update", id: "missing-owned-element", set: { x: 1 } },
        ],
      });
      check(
        invalid.ok === false && invalid.mutation === "not-applied",
        "Invalid mixed CLI request was not rejected atomically",
      );
      const after = ok(
        await command("read", {
          path,
          view: live.viewId,
          source: "live",
          detail: "elements",
        }),
      ).data;
      check(
        after.revision === current.revision &&
          (await app.vault.read(view.file)) === before,
        "Rejected CLI request mutated the scene or disk",
      );
      view = await env.saveReopen(view);
      check(
        view.getViewElements().find((el) => el.id === target.id)?.opacity === 0,
        "CLI edit changed after reopen",
      );
      return {
        assertions: row.assertions,
        evidenceKind: "native-cli-commands",
        commands: ["read", "apply"],
        actual: env.geometry(),
        reopened: true,
      };
    });
}
