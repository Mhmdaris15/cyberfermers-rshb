import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function Forbidden() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(40rem_24rem_at_50%_30%,#000_30%,transparent_75%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.65, 0.2, 1] }}
        className="glass-strong relative max-w-md rounded-2xl p-10 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rust/15 text-rust">
          {/* keyhole — drawn so it's not a generic emoji */}
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 4a4 4 0 0 1 4 4c0 1.5-.8 2.7-2 3.4V18h-4v-6.6C8.8 10.7 8 9.5 8 8a4 4 0 0 1 4-4Z" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <h1 className="font-display text-2xl">Только для администраторов</h1>
        <p className="mt-2 text-ink-dim">
          У вас нет доступа к этому разделу. Если это ошибка — обратитесь
          к администратору вашей команды.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/farmers"
            className="rounded-md border border-line bg-bg-elevated px-4 py-2 text-sm transition-colors hover:bg-bg-subtle"
          >
            Вернуться к фермерам
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
