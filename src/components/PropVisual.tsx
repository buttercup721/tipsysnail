import type { CSSProperties } from 'react';
import type { TerrariumPropDefinition } from '../types/game';

type PropVisualProps = {
  definition: TerrariumPropDefinition;
  className?: string;
  size?: 'scene' | 'preview';
};

function PropVisual({ definition, className = '', size = 'scene' }: PropVisualProps) {
  const style = {
    width: size === 'preview' ? Math.max(28, Math.round(definition.width * 0.7)) : definition.width,
    height: size === 'preview' ? Math.max(24, Math.round(definition.height * 0.7)) : definition.height,
    ['--prop-accent' as string]: definition.accent,
    ['--prop-secondary' as string]: definition.secondaryAccent
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={['prop-visual', `prop-visual--${definition.variant}`, `prop-visual--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <span className="prop-visual__core" />
      <span className="prop-visual__detail" />
    </span>
  );
}

export default PropVisual;
