# Portal the Select dropdown panel to body (never clipped by parent overflow)
import io
p = "src/components/ui/select.tsx"
s = io.open(p, encoding="utf-8").read()

# 1) imports
if "createPortal" not in s:
    s = s.replace('import { motion, AnimatePresence } from "framer-motion";',
                  'import { motion, AnimatePresence } from "framer-motion";\nimport { createPortal } from "react-dom";')
if "useLayoutEffect" not in s:
    s = s.replace("import { useState", "import { useLayoutEffect, useState", 1)

# 2) anchor rect state (inside the component, after `const [open, setOpen]`)
old_open = "  const [open, setOpen] = useState(false);"
new_open = '''  const [open, setOpen] = useState(false);
  // anchor for the portal'd panel (never clipped by ancestor overflow)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);'''
assert old_open in s
s = s.replace(old_open, new_open, 1)

# 3) compute position when opening — insert before the AnimatePresence block
old_panel = '''      <AnimatePresence>
        {open && (
        <motion.ul
          ref={listRef}
          role="listbox"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="absolute right-0 left-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-md border border-line bg-white py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
        >'''
new_panel = '''      {createPortal(
      <AnimatePresence>
        {open && (
        <motion.ul
          ref={listRef}
          role="listbox"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          style={panelStyle ?? undefined}
          className="fixed z-[9999] max-h-64 overflow-y-auto rounded-md border border-line bg-white py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
        >'''
assert old_panel in s
s = s.replace(old_panel, new_panel, 1)

io.open(p, "w", encoding="utf-8").write(s)
print("select portal (step 1)")
