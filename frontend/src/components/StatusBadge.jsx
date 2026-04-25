import { motion } from 'framer-motion';
import {
  ClockIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

const STATUS_MAP = {
  pending: {
    label: 'Pending',
    icon: ClockIcon,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/20',
    pulse: true,
  },
  processing: {
    label: 'Processing',
    icon: CogIcon,
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    ring: 'ring-blue-500/20',
    pulse: true,
    spin: true,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircleIcon,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/20',
    pulse: false,
  },
  failed: {
    label: 'Failed',
    icon: XCircleIcon,
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    ring: 'ring-red-500/20',
    pulse: false,
  },
};

export default function StatusBadge({ status, size = 'md' }) {
  const config = STATUS_MAP[status] || STATUS_MAP.pending;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={clsx(
        'inline-flex items-center rounded-full font-medium border ring-1',
        config.bg,
        config.text,
        config.border,
        config.ring,
        sizeClasses[size]
      )}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              status === 'pending' ? 'bg-amber-400' : 'bg-blue-400'
            )}
          />
          <span
            className={clsx(
              'relative inline-flex rounded-full h-2 w-2',
              status === 'pending' ? 'bg-amber-400' : 'bg-blue-400'
            )}
          />
        </span>
      )}
      <Icon
        className={clsx(
          iconSizes[size],
          config.spin && 'animate-spin'
        )}
      />
      {config.label}
    </motion.span>
  );
}