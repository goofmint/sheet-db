/**
 * Step Indicator Component
 *
 * Visual indicator for the current step in the setup wizard
 */

import type { FC } from 'hono/jsx/dom';
import { styles } from '../Setup.css';

interface StepIndicatorProps {
  number: number;
  active: boolean;
  completed: boolean;
  label: string;
}

/**
 * Step indicator component
 */
export const StepIndicator: FC<StepIndicatorProps> = ({ number, active, completed, label }) => {
  const bgColor = completed ? '#10b981' : active ? '#3b82f6' : '#e5e7eb';
  const textColor = completed || active ? '#ffffff' : '#9ca3af';

  return (
    <div style={styles.stepIndicatorContainer}>
      <div style={styles.stepIndicatorCircle(bgColor, textColor)}>
        {completed ? '✓' : number}
      </div>
      <div style={styles.stepIndicatorLabel(active)}>{label}</div>
    </div>
  );
};
