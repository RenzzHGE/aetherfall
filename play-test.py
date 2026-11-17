"""AETHERFALL play-test + screenshots (Python Playwright).
Serves game/ locally, drives the real game, asserts the full loop, and takes
4 real screenshots via the ?shot= scenes. Exits non-zero on any failure.
"""
import json
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

GAME_DIR = os.path.expanduser("~/workspace/makefun/best-game-01/game-c")
PORT = 8931
BASE = f"http://127.0.0.1:{PORT}"
SHOT_DIR = os.path.join(GAME_DIR, "screenshots")

errors = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))
    if not ok:
        errors.append(name)


def main():
    # Serve game/ with the kit's serve.ts (static, no build).
    server = subprocess.Popen(
        ["node", "serve.ts", "--port", str(PORT)],
        cwd=GAME_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page_errors = []
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            page.on("console", lambda m: page_errors.append(m.text) if m.type == "error" else None)

            # --- Title ---
            page.goto(f"{BASE}/index.html?seed=42", wait_until="load")
            page.wait_for_timeout(800)
            check("title shows", page.evaluate("() => document.title") == "AETHERFALL")
            page.screenshot(path=os.path.join(SHOT_DIR, "1-title.jpg"))

            # --- Start the game ---
            page.keyboard.press(" ")
            page.wait_for_timeout(500)
            state = page.evaluate("""() => {
                const s = document.getElementById('status').textContent;
                return s;
            }""")
            check("game starts on Space", "Playing" in state, state)

            # --- Move + shoot, kill enemies, clear wave 1 ---
            # Aim at real enemies via the debug hook: kite away from the nearest
            # one while shooting it. Restart and retry if the warden dies.
            def game_state():
                return page.evaluate("""() => {
                    const g = window.__aetherfall;
                    if (!g) return { screen: '?', enemies: 0, hp: 0, wave: 0 };
                    return { screen: g.screen, enemies: g.world.enemies.length,
                             hp: Math.ceil(g.world.player.hp), wave: g.world.wave };
                }""")

            def nearest_enemy():
                return page.evaluate("""() => {
                    const g = window.__aetherfall;
                    if (!g || !g.world.enemies.length) return null;
                    const p = g.world.player;
                    let best = null, bd = 1e12;
                    for (const e of g.world.enemies) {
                        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
                        if (d < bd) { bd = d; best = { x: e.x, y: e.y }; }
                    }
                    return best;
                }""")

            def hunt(seconds):
                """Kite + shoot for up to `seconds`. Returns True if the upgrade screen appears."""
                end = time.time() + seconds
                page.mouse.down()
                while time.time() < end:
                    e = nearest_enemy()
                    st = game_state()
                    if st["screen"] == "upgrade":
                        page.mouse.up()
                        return True
                    if st["screen"] == "over":
                        page.mouse.up()
                        return False
                    if e:
                        page.mouse.move(e["x"], e["y"])
                        # Kite: move away from the enemy.
                        p = page.evaluate("""() => {
                            const g = window.__aetherfall;
                            return { x: g.world.player.x, y: g.world.player.y };
                        }""")
                        dx = p["x"] - e["x"]
                        dy = p["y"] - e["y"]
                        key = "a" if abs(dx) > abs(dy) and dx < 0 else "d" if abs(dx) > abs(dy) else "w" if dy < 0 else "s"
                        page.keyboard.down(key)
                        page.wait_for_timeout(260)
                        page.keyboard.up(key)
                    else:
                        page.wait_for_timeout(300)
                page.mouse.up()
                return game_state()["screen"] == "upgrade"

            page.mouse.move(900, 300)
            page.keyboard.down("d")
            page.wait_for_timeout(800)
            page.keyboard.up("d")
            cleared = hunt(45)
            if not cleared and game_state()["screen"] == "over":
                # Died: restart and try once more.
                page.keyboard.press(" ")
                page.wait_for_timeout(500)
                cleared = hunt(45)
            check("wave 1 clears and upgrade screen appears", cleared)

            hud = page.evaluate("""() => {
                const c = document.querySelector('#game');
                return c ? c.width + 'x' + c.height : 'no canvas';
            }""")
            check("canvas alive after combat", hud == "1280x720", hud)

            if cleared:
                page.screenshot(path=os.path.join(SHOT_DIR, "3-upgrade.jpg"))
                # Pick card 1 with keyboard.
                page.keyboard.press("1")
                page.wait_for_timeout(600)
                st = page.evaluate("() => document.getElementById('status').textContent")
                check("upgrade picked, next wave starts", "Picked" in st and "Wave" in st, st)

            # --- Pause / resume ---
            page.keyboard.press("p")
            page.wait_for_timeout(300)
            st = page.evaluate("() => document.getElementById('status').textContent")
            check("pause works", "Paused" in st, st)
            page.keyboard.press("p")
            page.wait_for_timeout(300)
            st = page.evaluate("() => document.getElementById('status').textContent")
            check("resume works", "Playing" in st, st)

            # --- Staged screenshots (real renders via ?shot=) ---
            for shot, fname in [("combat", "2-combat.jpg"), ("boss", "4-boss.jpg")]:
                page.goto(f"{BASE}/index.html?shot={shot}&seed=7", wait_until="load")
                page.wait_for_function("() => window.__shotReady === true", timeout=10000)
                page.wait_for_timeout(200)
                page.screenshot(path=os.path.join(SHOT_DIR, fname))

            check("no page errors", len(page_errors) == 0, "; ".join(page_errors[:3]))
            browser.close()
    finally:
        server.terminate()

    # --- Screenshot size checks ---
    for f in ["1-title.jpg", "2-combat.jpg", "3-upgrade.jpg", "4-boss.jpg"]:
        p = os.path.join(SHOT_DIR, f)
        if os.path.exists(p):
            kb = os.path.getsize(p) // 1024
            check(f"screenshot {f} < 256 KiB", os.path.getsize(p) < 262144, f"{kb} KiB")
        else:
            check(f"screenshot {f} exists", False)

    print()
    if errors:
        print(f"FAILED: {len(errors)} check(s): {errors}")
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
