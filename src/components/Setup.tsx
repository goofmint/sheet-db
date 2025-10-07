/**
 * Setup Wizard Component
 *
 * Multi-step setup wizard for initial configuration:
 * Step 1: Google OAuth2 credentials input
 * Step 2: Sheet selection (after OAuth callback)
 * Step 2.5: Sheet initialization with progress indicator
 * Step 3: File storage and admin user configuration
 */

import type { FC } from 'hono/jsx/dom';
import { styles } from './Setup.css';
import { StepIndicator } from './setup/StepIndicator';
import { Step1GoogleCredentials } from './setup/Step1GoogleCredentials';
import { Step2SheetSelection } from './setup/Step2SheetSelection';
import { Step25SheetInitialization } from './setup/Step25SheetInitialization';
import { Step3FinalConfiguration } from './setup/Step3FinalConfiguration';

interface SetupProps {
  step: number;
  error?: string;
  sheets?: Array<{ id: string; name: string; url: string }>;
  initProgress?: {
    users: boolean;
    roles: boolean;
    files: boolean;
  };
}

/**
 * Setup Wizard Component
 *
 * Renders different steps based on the `step` prop
 */
export const Setup: FC<SetupProps> = ({ step, error, sheets, initProgress }) => {
  return (
    <div>
      <h1 style={styles.container}>Initial Setup</h1>
      <p style={styles.subtitle}>Connect to Google Sheets and configure your backend</p>

      {/* Progress indicator */}
      <div style={styles.progressContainer}>
        <StepIndicator number={1} active={step === 1} completed={step > 1} label="Credentials" />
        <StepIndicator number={2} active={step === 2} completed={step > 2} label="Sheet Selection" />
        <StepIndicator number={3} active={step === 3} completed={step > 3} label="Configuration" />
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.errorBox}>
          <p style={styles.errorText}>
            ❌ <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Step content */}
      {step === 1 && <Step1GoogleCredentials />}
      {step === 2 && <Step2SheetSelection sheets={sheets} />}
      {step === 2.5 && <Step25SheetInitialization progress={initProgress} />}
      {step === 3 && <Step3FinalConfiguration />}
    </div>
  );
};
