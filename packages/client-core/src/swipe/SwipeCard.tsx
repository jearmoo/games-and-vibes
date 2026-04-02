import { useState, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'motion/react';
import type { SwipeCardProps, SwipeZoneMapping, SwipeDirection } from './types.js';
import SwipeHints from './SwipeHints.js';

/** Dominance ratio: vertical must exceed horizontal * this ratio to count as vertical (and vice versa) */
const AXIS_DOMINANCE = 0.7;

const DEFAULT_NEUTRAL = {
  bgTint: 'transparent',
  glowShadow: '0 4px 30px rgba(0,0,0,0.4)',
  borderColor: 'rgba(255,255,255,0.08)',
};

function detectZone(
  offsetX: number,
  offsetY: number,
  zones: SwipeZoneMapping[],
  dragAxis: 'x' | 'both',
): SwipeZoneMapping | null {
  const ax = Math.abs(offsetX);
  const ay = Math.abs(offsetY);

  for (const mapping of zones) {
    const { direction, threshold } = mapping;
    if (dragAxis === 'x' && (direction === 'up' || direction === 'down')) continue;

    switch (direction) {
      case 'right':
        if (offsetX > threshold && (dragAxis === 'x' || ax > ay * AXIS_DOMINANCE)) return mapping;
        break;
      case 'left':
        if (offsetX < -threshold && (dragAxis === 'x' || ax > ay * AXIS_DOMINANCE)) return mapping;
        break;
      case 'down':
        if (offsetY > threshold && ay > ax * AXIS_DOMINANCE) return mapping;
        break;
      case 'up':
        if (offsetY < -threshold && ay > ax * AXIS_DOMINANCE) return mapping;
        break;
    }
  }
  return null;
}

function exitTarget(direction: SwipeDirection, style: 'flyout' | 'spring') {
  const dist = style === 'flyout' ? window.innerWidth : 400;
  switch (direction) {
    case 'left':
      return { x: -dist, y: 0 };
    case 'right':
      return { x: dist, y: 0 };
    case 'up':
      return { x: 0, y: -dist };
    case 'down':
      return { x: 0, y: dist };
  }
}

export default function SwipeCard({
  dragAxis = 'both',
  dragElastic = 0.7,
  zones,
  hints,
  onSwipe,
  onTap,
  locked = false,
  exitStyle = 'flyout',
  widthClass = 'w-52',
  aspectRatio = '2.5 / 4',
  className = '',
  children,
  renderZoneLabel,
  cooldownMs = 0,
  onExitComplete,
}: SwipeCardProps) {
  const [activeDirection, setActiveDirection] = useState<SwipeDirection | null>(null);
  const [activeZoneMapping, setActiveZoneMapping] = useState<SwipeZoneMapping | null>(null);
  const [exiting, setExiting] = useState(false);
  const isDraggingRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);

  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      const mapping = detectZone(info.offset.x, info.offset.y, zones, dragAxis);
      setActiveZoneMapping(mapping);
      setActiveDirection(mapping?.direction ?? null);
    },
    [zones, dragAxis],
  );

  const fireExit = useCallback(
    (direction: SwipeDirection, zoneId: string) => {
      setExiting(true);
      const target = exitTarget(direction, exitStyle);

      if (exitStyle === 'flyout') {
        // Imperative flyout — card leaves the screen
        Promise.all([
          animate(x, target.x, { duration: 0.25, ease: 'easeIn' }),
          animate(y, target.y, { duration: 0.25, ease: 'easeIn' }),
        ]).then(() => {
          const finish = () => {
            onSwipe({ zoneId, direction });
            onExitComplete?.();
          };
          if (cooldownMs > 0) setTimeout(finish, cooldownMs);
          else finish();
        });
      } else {
        // Spring exit — handled by motion.div animate prop, report after transition
        setTimeout(() => {
          const finish = () => {
            onSwipe({ zoneId, direction });
            onExitComplete?.();
          };
          if (cooldownMs > 0) setTimeout(finish, cooldownMs);
          else finish();
        }, 300);
      }
    },
    [exitStyle, x, y, onSwipe, onExitComplete, cooldownMs],
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const mapping = detectZone(info.offset.x, info.offset.y, zones, dragAxis);
      if (mapping) {
        fireExit(mapping.direction, mapping.zone.id);
      } else {
        setActiveZoneMapping(null);
        setActiveDirection(null);
      }
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    },
    [zones, dragAxis, fireExit],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current || !onTap || exiting || locked) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX;
      const side = clientX - rect.left > rect.width / 2 ? 'right' : 'left';
      onTap(side);
    },
    [onTap, exiting, locked],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isDraggingRef.current || !onTap || exiting || locked) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.changedTouches[0].clientX;
      const side = clientX - rect.left > rect.width / 2 ? 'right' : 'left';
      onTap(side);
    },
    [onTap, exiting, locked],
  );

  const zone = activeZoneMapping?.zone ?? null;
  const isActive = zone !== null;

  // Spring exit animation target
  const springExitAnim =
    exiting && exitStyle === 'spring' && activeDirection
      ? {
          ...exitTarget(activeDirection, 'spring'),
          opacity: 0,
          scale: 0.8,
        }
      : undefined;

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: '100%' }}>
      {hints && <SwipeHints hints={hints} activeDirection={activeDirection} />}

      <motion.div
        drag={!exiting && !locked ? (dragAxis === 'x' ? 'x' : true) : false}
        dragElastic={dragElastic}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, y, rotate, boxShadow: zone?.glowShadow ?? DEFAULT_NEUTRAL.glowShadow }}
        animate={springExitAnim}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className={`relative touch-none select-none z-10 ${widthClass} ${locked || exiting ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'} ${className}`}
        onClick={handleClick}
        onTouchEnd={onTap ? handleTouchEnd : undefined}
      >
        <div
          className="w-full rounded-2xl overflow-hidden transition-colors duration-150"
          style={{
            aspectRatio,
            background: isActive ? zone!.bgTint : DEFAULT_NEUTRAL.bgTint,
          }}
        >
          <div
            className="h-full flex flex-col rounded-2xl overflow-hidden border-2 transition-colors duration-150"
            style={{ borderColor: zone?.borderColor ?? DEFAULT_NEUTRAL.borderColor, maxHeight: '100%' }}
          >
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
          </div>
        </div>

        {/* Zone label overlay */}
        {renderZoneLabel ? (
          renderZoneLabel(zone, activeDirection)
        ) : (
          isActive && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <div
                className={`font-display text-5xl tracking-wider ${zone!.labelColor} drop-shadow-lg`}
                style={{ textShadow: zone!.labelTextShadow }}
              >
                {zone!.label}
              </div>
            </motion.div>
          )
        )}
      </motion.div>
    </div>
  );
}
