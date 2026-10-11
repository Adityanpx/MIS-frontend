import type { PreviewKind } from './widgets';

/** Tiny illustrations for the "Add widget" drawer (the video's grey preview tiles). Pure SVG, no data. */
export function WidgetPreview({ kind }: { kind: PreviewKind }) {
  const b = '#2B61F9';
  const soft = '#DCE6FD';
  const grey = '#E3E4EA';
  const common = { width: 88, height: 64, viewBox: '0 0 88 64', 'aria-hidden': true } as const;
  switch (kind) {
    case 'kpi':
      return (
        <svg {...common}>
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${4 + i * 42} 10)`}>
              <rect width="38" height="44" rx="8" fill="#fff" />
              <rect x="6" y="8" width="18" height="4" rx="2" fill={grey} />
              <rect x="6" y="18" width="22" height="8" rx="3" fill="#0B0C10" opacity=".85" />
              <rect x="6" y="31" width="14" height="5" rx="2" fill="#5BCD87" />
            </g>
          ))}
        </svg>
      );
    case 'line':
      return (
        <svg {...common}>
          <rect x="4" y="8" width="80" height="48" rx="8" fill="#fff" />
          <path
            d="M10 44 C 20 30, 28 38, 38 28 S 58 30, 66 20 S 76 22, 80 16"
            fill="none"
            stroke={b}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M10 48 C 22 42, 32 46, 44 38 S 64 40, 80 32"
            fill="none"
            stroke="#A3A3AD"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          {['#E5456F', '#ED873D', b].map((c, i) => (
            <g key={c} transform={`translate(10 ${12 + i * 15})`}>
              <rect width="10" height="10" rx="3" fill={c} opacity=".18" />
              <circle cx="5" cy="5" r="2" fill={c} />
              <rect x="16" y="1" width="40" height="3.5" rx="1.75" fill="#3E3E40" opacity=".7" />
              <rect x="16" y="6.5" width="28" height="3" rx="1.5" fill={grey} />
            </g>
          ))}
        </svg>
      );
    case 'bars':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          {[22, 30, 26, 38, 28, 24, 32].map((h, i) => (
            <rect key={i} x={12 + i * 10} y={52 - h} width="6" height={h} rx="3" fill={i === 3 ? b : grey} />
          ))}
        </svg>
      );
    case 'gauge':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          {Array.from({ length: 15 }, (_, i) => {
            const a = Math.PI * (1 - i / 14);
            const r = (n: number) => Math.round(n * 10) / 10;
            return (
              <line
                key={i}
                x1={r(44 + 16 * Math.cos(a))}
                y1={r(48 - 16 * Math.sin(a))}
                x2={r(44 + 24 * Math.cos(a))}
                y2={r(48 - 24 * Math.sin(a))}
                stroke={i < 11 ? '#47D986' : grey}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      );
    case 'cards':
      return (
        <svg {...common}>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${4 + i * 28} 8)`}>
              <rect width="24" height="48" rx="6" fill="#fff" />
              <rect x="4" y="6" width="12" height="3" rx="1.5" fill={grey} />
              <rect x="4" y="12" width="14" height="6" rx="2" fill="#0B0C10" opacity=".8" />
              {[0, 1, 2].map((k) => (
                <rect
                  key={k}
                  x={4 + k * 6}
                  y={40 - (k + 2) * 4}
                  width="4"
                  height={(k + 2) * 4}
                  rx="1.5"
                  fill={k === 2 ? b : soft}
                />
              ))}
            </g>
          ))}
        </svg>
      );
    case 'table':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(10 ${13 + i * 11})`}>
              <rect width="6" height="6" rx="2" fill={grey} />
              <rect x="10" y="1" width="26" height="4" rx="2" fill="#3E3E40" opacity=".6" />
              <rect x="48" y="1" width="14" height="4" rx="2" fill={i === 1 ? '#E5456F' : '#5BCD87'} opacity=".8" />
              {i < 3 && <line x1="0" y1="9" x2="68" y2="9" stroke={grey} strokeDasharray="2 2" />}
            </g>
          ))}
        </svg>
      );
    case 'band':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(12 ${16 + i * 13})`}>
              <rect width="64" height="5" rx="2.5" fill={grey} />
              <rect x="8" width="34" height="5" rx="2.5" fill="#D3F1E0" />
              <circle
                cx={[22, 30, 52][i]}
                cy="2.5"
                r="4"
                fill={i === 2 ? '#E5456F' : '#47D986'}
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>
      );
    case 'cash':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          <rect x="12" y="14" width="30" height="8" rx="3" fill="#0B0C10" opacity=".85" />
          <path
            d="M12 48 L 28 40 L 44 44 L 60 32 L 76 34"
            fill="none"
            stroke={b}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'people':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          {[b, '#5BCD87', '#ED873D'].map((c, i) => (
            <g key={c} transform={`translate(${12 + i * 22} 16)`}>
              <rect width="2" height="20" fill={c} />
              <rect x="4" y="2" width="10" height="5" rx="2" fill="#0B0C10" opacity=".75" />
              <rect y="30" width={[20, 18, 12][i]} height="4" rx="2" fill={c} />
            </g>
          ))}
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="80" height="52" rx="8" fill="#fff" />
          <path
            d="M44 14 l14 5 v10 c0 9 -6 14 -14 17 c-8 -3 -14 -8 -14 -17 v-10 z"
            fill={soft}
            stroke={b}
            strokeWidth="2"
          />
          <path d="M38 31 l4 4 l8 -8" fill="none" stroke={b} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
  }
}
