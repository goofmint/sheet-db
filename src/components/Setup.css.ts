/**
 * Setup Wizard Styles
 */

export const styles = {
  // Container
  container: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
  },
  subtitle: {
    color: '#6b7280',
    margin: '0 0 32px 0',
  },

  // Progress
  progressContainer: {
    marginBottom: '32px',
    display: 'flex',
    gap: '8px',
  },
  stepIndicatorContainer: {
    flex: 1,
    textAlign: 'center' as const,
  },
  stepIndicatorCircle: (bgColor: string, textColor: string) => ({
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: bgColor,
    color: textColor,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    marginBottom: '8px',
  }),
  stepIndicatorLabel: (active: boolean) => ({
    fontSize: '12px',
    color: active ? '#1f2937' : '#9ca3af',
  }),

  // Error
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '24px',
  },
  errorText: {
    margin: 0,
    color: '#991b1b',
    fontSize: '14px',
  },

  // Card
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 16px 0',
  },
  cardDescription: {
    color: '#6b7280',
    fontSize: '14px',
    margin: '0 0 16px 0',
  },

  // Form
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  formLarge: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },

  // Input
  inputLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
  },
  inputReadOnly: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#f9fafb',
  },
  inputHelp: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  },

  // Select
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
  },

  // Button
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
  },

  // Note box
  noteBox: {
    backgroundColor: '#eff6ff',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    padding: '12px 16px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteText: {
    fontSize: '13px',
    color: '#1e40af',
  },

  // Warning box
  warningBox: {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '16px',
  },
  warningTitle: {
    margin: '0 0 8px 0',
    color: '#92400e',
    fontSize: '14px',
    fontWeight: '500',
  },
  warningList: {
    margin: '0',
    paddingLeft: '20px',
    color: '#92400e',
    fontSize: '13px',
  },

  // Link
  link: {
    color: '#3b82f6',
    textDecoration: 'underline',
  },
  linkButton: {
    display: 'inline-block',
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },

  // Fieldset
  fieldset: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '16px',
  },
  legend: {
    fontSize: '16px',
    fontWeight: '500',
    padding: '0 8px',
  },

  // Label (radio/checkbox)
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },

  // R2 fields
  r2Fields: {
    display: 'none',
    gap: '12px',
    flexDirection: 'column' as const,
  },
  r2FieldsVisible: {
    display: 'flex',
    gap: '12px',
    flexDirection: 'column' as const,
  },

  // Progress item
  progressItemContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  progressItemCircle: (completed: boolean) => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: completed ? '#10b981' : '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
  }),
  progressItemText: (completed: boolean) => ({
    fontSize: '14px',
    color: completed ? '#10b981' : '#6b7280',
  }),

  // Completion section
  completionContainer: {
    marginTop: '24px',
  },
  completionText: {
    color: '#10b981',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '16px',
  },
  completionButton: {
    display: 'inline-block',
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'none',
  },

  // Empty state
  emptyText: {
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '16px',
  },

  // Flex containers
  flexColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  flexColumnGap16: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  flexColumnGap20: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  marginBottom16: {
    marginBottom: '16px',
  },
  marginBottom24: {
    marginBottom: '24px',
  },
};
