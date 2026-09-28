// src/components/TeamBadge.tsx

import { getTeamColor, getTeamInitials } from '../utils/teamColors';

interface Props {
  clubId: string;
  shortName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
}

const SIZE_MAP = {
  xs: { box: 'w-5 h-5 text-[8px]',   name: 'text-[9px]'  },
  sm: { box: 'w-7 h-7 text-[10px]',  name: 'text-xs'     },
  md: { box: 'w-10 h-10 text-sm',    name: 'text-sm'     },
  lg: { box: 'w-14 h-14 text-lg',    name: 'text-base'   },
  xl: { box: 'w-20 h-20 text-2xl',   name: 'text-lg'     },
};

export function TeamBadge({ clubId, shortName, size = 'md', showName = false }: Props) {
  const color = getTeamColor(clubId);
  const initials = getTeamInitials(shortName);
  const sizes = SIZE_MAP[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizes.box} rounded-full flex items-center justify-center font-bold shadow-md flex-shrink-0`}
        style={{
          backgroundColor: color.bg,
          color: color.fg,
          boxShadow: `0 0 12px ${color.bg}40`,
        }}
      >
        {initials}
      </div>
      {showName && (
        <span className={`${sizes.name} font-semibold text-slate-200`}>
          {shortName}
        </span>
      )}
    </div>
  );
}