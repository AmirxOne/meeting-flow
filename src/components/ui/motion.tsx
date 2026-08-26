"use client";

import { motion, AnimatePresence, type Transition } from "framer-motion";

/** Shared easing — quick and professional, never bouncy. */
export const easeOut: Transition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] };
export const easeSmooth: Transition = { duration: 0.28, ease: [0.23, 1, 0.32, 1] };

/** Fade+rise for page content entering. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...easeOut, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Staggered list container — children animate in sequence. */
export function StaggerList({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: delay } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Staggered item — pair with StaggerList. */
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: easeOut } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Dropdown/panel enter+exit (scale from top, RTL-friendly). */
export function MotionDropdown({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
          transition={easeOut}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Modal/backdrop with spring-free scale. */
export function MotionModal({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="fixed inset-0 z-50 bg-black/40"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.14 } }}
            transition={easeSmooth}
            className={className}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Toast enter/exit. */
export function MotionToast({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.13 } }}
      transition={easeOut}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export { motion, AnimatePresence };
