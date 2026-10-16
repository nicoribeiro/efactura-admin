/** Icono del panel: el mismo dibujo que public/favicon.svg */
export const Logo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <rect width="32" height="32" rx="7" fill="#1677ff" />
    <path
      d="M9 6h10l5 5v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
      fill="#fff"
    />
    <path d="M19 6v4a1 1 0 0 0 1 1h4z" fill="#bcd6ff" />
    <path
      d="M11 12h5M11 15.5h9"
      stroke="#1677ff"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M12.5 21.2l2.6 2.6 5-5"
      fill="none"
      stroke="#52c41a"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
