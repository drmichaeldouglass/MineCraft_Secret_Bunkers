import { system, world } from "@minecraft/server";
import { NS } from "./core/types.js";
import { dirty, facilities, load, save } from "./runtime/store.js";
import { giveKit, interact, runMenu, scheduleDevice } from "./runtime/menus.js";
import { report } from "./runtime/world.js";
import { registerDoorEvents, restoreDoors, tickAlarms, tickDoors, tickLasers } from "./runtime/security.js";
import { registerDefenceEvents, tickDefence } from "./runtime/defence.js";
import { tickMissiles, tickPlaced } from "./runtime/placed.js";
system.beforeEvents.startup.subscribe(event => {
    event.blockComponentRegistry.registerCustomComponent(NS + "interact", {
        onPlayerInteract: e => { if (e.player) {
            const player = e.player, pos = { ...e.block.location };
            system.run(() => runMenu(player, () => interact(player, pos)));
        } },
    });
    event.itemComponentRegistry.registerCustomComponent(NS + "use_device", {
        onUse: e => { if (e.itemStack)
            scheduleDevice(e.source, e.itemStack.typeId); },
    });
});
world.afterEvents.worldLoad.subscribe(() => {
    // A demolished or demolishing facility's doors are rubble now; repainting them would rebuild them.
    try {
        load();
        for (const f of facilities.values())
            if (f.phase === "ready" && f.destructionStep === undefined && f.state !== "DESTROYED")
                restoreDoors(f);
    }
    catch (error) {
        report(error);
    }
    registerDefenceEvents();
    registerDoorEvents();
    const safe = (work) => () => { try {
        work();
    }
    catch (error) {
        report(error);
    } };
    system.runInterval(safe(tickDoors), 1);
    system.runInterval(safe(tickLasers), 5);
    system.runInterval(safe(tickDefence), 5);
    system.runInterval(safe(tickPlaced), 5);
    system.runInterval(safe(tickMissiles), 1);
    system.runInterval(safe(tickAlarms), 10);
    system.runInterval(safe(() => { for (const id of [...dirty]) {
        const f = facilities.get(id);
        if (f)
            save(f);
        else
            dirty.delete(id);
    } }), 40);
    console.warn("[Secret Facilities] 0.1.0 loaded. Creative inventory → Facility Deployment Device. /scriptevent secretfacilities:kit supplies a kit.");
});
system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id !== NS + "kit")
        return;
    const source = event.sourceEntity;
    if (source?.typeId !== "minecraft:player")
        return;
    const player = world.getAllPlayers().find(p => p.id === source.id);
    if (!player)
        return;
    try {
        giveKit(player);
    }
    catch (error) {
        report(error, player);
    }
});
