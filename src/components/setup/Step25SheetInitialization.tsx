/**
 * Step 2.5: Sheet Initialization Progress Component
 *
 * Displays progress of sheet initialization
 */

import type { FC } from 'hono/jsx/dom';
import { styles } from '../Setup.css';

interface InitProgress {
  users: boolean;
  roles: boolean;
  files: boolean;
}

interface Step25SheetInitializationProps {
  progress?: InitProgress;
}

/**
 * Step 2.5: Sheet Initialization Progress
 */
export const Step25SheetInitialization: FC<Step25SheetInitializationProps> = ({
  progress = { users: false, roles: false, files: false }
}) => {
  return (
    <div
      style={styles.card}
    >
      <h2 style={styles.cardTitle}>
        Initializing Sheet
      </h2>
      <p style={{ ...styles.cardDescription, margin: '0 0 24px 0' }}>
        Creating required sheets and setting up headers...
      </p>

      <div style={styles.flexColumnGap16}>
        <ProgressItem label="Creating _Users sheet" completed={progress.users} />
        <ProgressItem label="Creating _Roles sheet" completed={progress.roles} />
        <ProgressItem label="Creating _Files sheet" completed={progress.files} />
      </div>

      {progress.users && progress.roles && progress.files && (
        <div style={styles.completionContainer}>
          <p style={styles.completionText}>
            ✓ Sheet initialization completed!
          </p>
          <a
            href="/setup?step=3"
            style={styles.completionButton}
          >
            Continue to Final Configuration
          </a>
        </div>
      )}
    </div>
  );
};

/**
 * Progress Item Component
 *
 * Individual progress indicator for sheet initialization
 */
export const ProgressItem: FC<{ label: string; completed: boolean }> = ({ label, completed }) => {
  return (
    <div style={styles.progressItemContainer}>
      <div style={styles.progressItemCircle(completed)}>
        {completed ? '✓' : '...'}
      </div>
      <span style={styles.progressItemText(completed)}>{label}</span>
    </div>
  );
};
