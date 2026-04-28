import React from 'react';
import { motion } from 'framer-motion';

export function StreamingLoader3D() {
  return (
    <div className="relative w-[32px] h-[32px] mx-auto flex items-center justify-center">
      {/* Outer rotating ring */}
      <motion.div
        className="absolute w-[26px] h-[26px] rounded-full border-[1.5px] border-white/15"
        style={{
          borderTopColor: 'rgba(255,255,255,0.7)',
          filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.2))',
        }}
        animate={{
          rotateX: [60, 60, 60],
          rotateZ: [0, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Inner glowing sphere (glassmorphic 3D illusion) */}
      <motion.div
        className="absolute w-[14px] h-[14px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.05) 80%, transparent 100%)',
          boxShadow:
            '0 0 6px rgba(255,255,255,0.2), inset -2px -2px 6px rgba(0,0,0,0.3), inset 2px 2px 6px rgba(255,255,255,0.5)',
          backdropFilter: 'blur(2px)',
        }}
        animate={{
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orbiting particle */}
      <motion.div
        className="absolute w-1 h-1 bg-white rounded-full"
        style={{
          boxShadow: '0 0 4px 1px rgba(255,255,255,0.7)',
        }}
        animate={{
          rotate: [0, 360],
          translateX: [12, 12],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}
