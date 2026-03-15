import { Zap } from 'lucide-react';

/**
 * Centralized Orbis logo — single source of truth for the brand mark.
 *
 * Usage:
 *   <OrbisLogo />                           — default (sm, with text)
 *   <OrbisLogo size="lg" />                 — large for auth panels
 *   <OrbisLogo size="xs" />                 — tiny for footers
 *   <OrbisLogo subtitle="Careers" />        — custom subtitle
 *   <OrbisLogo showText={false} />          — icon only
 *   <OrbisLogo variant="landing" />         — uses CSS accent vars
 */

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg';
export type LogoVariant = 'default' | 'landing';

interface OrbisLogoProps {
  /** xs=28px, sm=32px (nav), md=36px (public header), lg=80px (auth panels) */
  size?: LogoSize;
  /** Show "Orbis" text next to icon */
  showText?: boolean;
  /** Subtitle under "Orbis" (e.g. "Careers", "Candidate Portal") */
  subtitle?: string;
  /** "default" uses brand hex gradient; "landing" uses CSS accent vars */
  variant?: LogoVariant;
  /** Additional class on the root div */
  className?: string;
}

const sizeConfig = {
  xs: { box: 'h-7 w-7', icon: 'h-3.5 w-3.5', rounded: 'rounded-md', text: 'text-sm', subtitleText: 'text-[9px]', gap: 'gap-2' },
  sm: { box: 'h-8 w-8', icon: 'h-[18px] w-[18px]', rounded: 'rounded-lg', text: 'text-base', subtitleText: 'text-[10px]', gap: 'gap-2.5' },
  md: { box: 'h-9 w-9', icon: 'h-5 w-5', rounded: 'rounded-lg', text: 'text-sm font-bold', subtitleText: 'text-[10px]', gap: 'gap-2.5' },
  lg: { box: 'h-20 w-20', icon: 'h-10 w-10', rounded: 'rounded-2xl', text: 'text-4xl', subtitleText: 'text-sm', gap: 'gap-4' },
};

/** Brand gradient as inline style — responds to accent theme in "landing" variant */
function bgStyle(variant: LogoVariant): React.CSSProperties {
  if (variant === 'landing') {
    return { background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))' };
  }
  return { background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))' };
}

export function OrbisLogoIcon({ size = 'sm', variant = 'default' }: Pick<OrbisLogoProps, 'size' | 'variant'>) {
  const s = sizeConfig[size];
  return (
    <div
      className={`flex ${s.box} items-center justify-center ${s.rounded} shrink-0`}
      style={bgStyle(variant)}
    >
      <Zap aria-hidden="true" className={`${s.icon} text-white`} />
    </div>
  );
}

export default function OrbisLogo({
  size = 'sm',
  showText = true,
  subtitle,
  variant = 'default',
  className = '',
}: OrbisLogoProps) {
  const s = sizeConfig[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <OrbisLogoIcon size={size} variant={variant} />
      {showText && (
        <div>
          <span className={`${s.text} font-bold text-white tracking-tight`}>
            Orbis
          </span>
          {subtitle && (
            <span className={`${s.subtitleText} text-slate-500 ml-2`}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
