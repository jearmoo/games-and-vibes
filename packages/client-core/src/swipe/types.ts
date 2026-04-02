import type { ReactNode } from 'react';

/** Visual config for a named swipe zone */
export interface SwipeZone {
  /** Unique zone identifier, e.g. 'correct', 'pass', 'got1', 'bonked' */
  id: string;
  /** Human-readable label shown during drag, e.g. "CORRECT", "+3", "BONK!" */
  label: string;
  /** Tailwind text color class for the label, e.g. 'text-emerald-400' */
  labelColor: string;
  /** CSS text-shadow for the label glow */
  labelTextShadow?: string;
  /** Background tint (CSS rgba) applied to the card in this zone */
  bgTint: string;
  /** Box-shadow CSS for card glow in this zone */
  glowShadow: string;
  /** Border color (CSS rgba) for the card in this zone */
  borderColor: string;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** Maps a direction to a zone and its detection threshold */
export interface SwipeZoneMapping {
  direction: SwipeDirection;
  zone: SwipeZone;
  /** Pixel threshold to activate this zone */
  threshold: number;
}

/** Hint label shown at a card edge */
export interface SwipeHint {
  direction: SwipeDirection;
  label: string;
  sublabel?: string;
  /** Tailwind text color for the hint */
  color: string;
}

/** Payload reported when a swipe completes */
export interface SwipeAction {
  zoneId: string;
  direction: SwipeDirection;
}

export interface SwipeCardProps {
  /** Which axes are draggable. Default: 'both' */
  dragAxis?: 'x' | 'both';
  /** Drag elasticity (0-1). Default: 0.7 */
  dragElastic?: number;
  /** Zone mappings that define the swipe targets */
  zones: SwipeZoneMapping[];
  /** Optional hints to show around the card edges */
  hints?: SwipeHint[];
  /** Called when swipe completes into a valid zone */
  onSwipe: (action: SwipeAction) => void;
  /** Enable tap-to-act. Called with which half was tapped. */
  onTap?: (side: 'left' | 'right') => void;
  /** Whether the card is locked (no interaction). Default: false */
  locked?: boolean;
  /** Exit animation style. 'flyout' sends card off-screen; 'spring' uses spring physics with fade. Default: 'flyout' */
  exitStyle?: 'flyout' | 'spring';
  /** Card width class. Default: 'w-52' */
  widthClass?: string;
  /** Card aspect ratio CSS value. Default: '2.5 / 4' */
  aspectRatio?: string;
  /** Additional className for the card's draggable wrapper */
  className?: string;
  /** Card content — rendered inside the card frame */
  children: ReactNode;
  /** Override the default zone label overlay. Return null to suppress. */
  renderZoneLabel?: (activeZone: SwipeZone | null, direction: SwipeDirection | null) => ReactNode;
  /** Post-swipe cooldown in ms before the next card can appear. Default: 0 */
  cooldownMs?: number;
  /** Called when exit animation + cooldown complete (use to advance to next card) */
  onExitComplete?: () => void;
}

/** Config for a single action button */
export interface ActionButtonConfig {
  /** Unique ID (typically matches a zone ID) */
  id: string;
  label: string;
  /** Tailwind/CSS classes for the button */
  className: string;
}

export interface ActionButtonBarProps {
  /** Button configs rendered as rows. Each sub-array is one row. */
  rows: ActionButtonConfig[][];
  /** Called when any button is pressed */
  onAction: (id: string) => void;
}
