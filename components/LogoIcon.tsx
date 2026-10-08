// components/LogoIcon.tsx
//
// The Bakhaar logo: the green rounded square with the white "B".
// Drawn as SVG right in the page (no image to load, sharp at every size).
// The same shape is in public/brand/ as files (logo.svg, PNGs) for
// emails, the browser tab and the phone home screen.

/** The white "B" (the logo is 512 × 512). */
export const LOGO_B_PATH =
  "M139.3 415.2C139.3 383.8 139.7 378.7 142.6 372.4C146.9 363.3 152.0 359.6 182.8 343.3C222.8 322.0 250.9 306.7 272.0 294.4C276.8 291.6 283.0 288.0 285.8 286.4C309.8 272.7 331.6 257.0 346.4 242.7L353.2 236.2L367.8 245.9C388.5 259.6 395.3 266.3 401.1 278.7C409.4 296.6 407.5 318.4 396.0 334.6C389.0 344.6 375.7 355.4 360.2 363.7C346.4 370.9 333.5 376.1 290.7 391.3C276.0 396.5 261.7 401.6 258.9 402.6C256.0 403.6 243.0 408.2 230.0 412.8C203.6 421.9 142.6 443.4 140.5 444.2C139.3 444.7 139.3 443.0 139.3 415.2ZM188.3 296.1C179.2 288.8 163.7 276.6 153.7 268.8C143.8 261.1 135.7 254.6 135.8 254.3C135.9 254.0 141.1 249.3 147.3 243.7C153.5 238.2 163.4 229.3 169.3 224.1C187.7 207.6 208.1 189.7 208.7 189.5C209.0 189.3 216.7 195.0 225.7 202.1C280.5 245.2 283.0 247.3 283.0 248.4C283.0 248.8 280.7 251.0 277.9 253.1C275.1 255.3 269.1 259.8 264.7 263.2C260.3 266.5 247.9 276.1 237.3 284.3C214.6 301.9 205.0 309.3 204.8 309.2C204.8 309.2 197.3 303.3 188.3 296.1ZM337.1 222.3C291.6 188.1 276.1 177.1 268.5 173.6C246.3 163.3 213.6 163.4 180.0 173.9C171.2 176.7 150.2 184.2 144.2 186.7C138.8 189.0 139.3 193.7 139.3 134.8L139.3 81.8L219.2 82.2C263.1 82.4 303.0 82.7 307.9 82.9C333.8 83.8 355.2 93.0 370.7 109.6C381.8 121.6 388.1 135.5 390.1 152.4C393.1 177.1 383.2 200.8 358.5 228.3C355.7 231.4 353.2 233.9 352.9 233.9C352.7 233.9 345.6 228.7 337.1 222.3Z";

export const LOGO_GREEN = "#06B263";

export default function LogoIcon({ size = 32, className = "", title = "Bakhaar" }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={`shrink-0 ${className}`}
      style={{ display: "block" }}
    >
      <rect width="512" height="512" rx="116" fill={LOGO_GREEN} />
      <path fill="#fff" d={LOGO_B_PATH} />
    </svg>
  );
}