import { AnimatePresence, cubicBezier, motion } from 'framer-motion';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export function SendButton({ show, isStreaming, onClick }: SendButtonProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className="relative flex justify-center items-center shrink-0 p-1 bg-white hover:bg-zinc-200 color-black rounded-xl w-[34px] h-[34px] transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)]"
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={(event) => {
            event.preventDefault();
            onClick?.(event);
          }}
        >
          <div className="text-lg">
            {!isStreaming ? (
              <div className="i-ph:arrow-right font-bold"></div>
            ) : (
              <div className="i-ph:stop-circle-bold"></div>
            )}
          </div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
