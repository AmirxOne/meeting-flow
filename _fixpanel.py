# fix ordering: after dragstart, WAIT for the animated dock before hovering it
import io
p = "scripts/e2e-dnd-month-panel.cjs"
s = io.open(p, encoding="utf-8").read()

old = '''  // drag: chip → hover LEFT edge dock → panel opens → drop on +2 months tile
  const flow = await page.evaluate((mid) => {
    const chip = document.querySelector(`a[href="/meetings/${mid}"]`);
    const dock = document.querySelector('div[title="ماه‌های بعد"]');
    if (!chip || !dock) return { step: "find", chip: !!chip, dock: !!dock };
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    dock.dispatchEvent(new DragEvent("dragenter", { bubbles: true }));
    dock.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { step: "panel-check" };
  }, mid);
  await page.waitForTimeout(900);'''

new = '''  // drag: chip → (wait for animated dock to mount) → hover LEFT edge → panel opens
  let flow = { step: "start" };
  const dtObj = await page.evaluate((mid) => {
    const chip = document.querySelector(`a[href="/meetings/${mid}"]`);
    if (!chip) return { chip: false };
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { chip: true };
  }, mid);
  // wait for the dock to mount (AnimatePresence animation)
  await page.waitForTimeout(900);
  const dockFound = await page.evaluate(() => !!document.querySelector('div[title="ماه‌های بعد"]'));
  flow = { ...dtObj, dock: dockFound };
  if (dockFound) {
    await page.evaluate(() => {
      const dock = document.querySelector('div[title="ماه‌های بعد"]');
      const dt = new DataTransfer();
      dock.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
      dock.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
  }'''
assert old in s, "flow block not found"
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("ordering fixed")
