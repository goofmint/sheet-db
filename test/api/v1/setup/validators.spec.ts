import { describe, it, expect } from 'vitest';
import { validateSetupRequest, validateConfigPassword } from '../../../../src/api/v1/setup/validators';

describe('Setup Validators', () => {
  const validSetupData = {
    google: {
      clientId: "123456789-abcdefghijklmnop.apps.googleusercontent.com",
      clientSecret: "GOCSPX-abcdefghijklmnopqrstuvwxyz"
    },
    auth0: {
      domain: "test-domain.auth0.com",
      clientId: "abcdefghijklmnopqrstuvwxyz123456",
      clientSecret: "abcdefghijklmnopqrstuvwxyz123456789abcdefghijklmn"
    },
    app: {
      configPassword: "SecurePass123!"
    },
  };

  describe('validateSetupRequest', () => {
    it('should validate complete valid request', () => {
      const result = validateSetupRequest(validSetupData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validSetupData);
    });


    it('should reject null/undefined input', () => {
      const result1 = validateSetupRequest(null);
      expect(result1.isValid).toBe(false);
      expect(result1.errors[0].field).toBe('root');

      const result2 = validateSetupRequest(undefined);
      expect(result2.isValid).toBe(false);
      expect(result2.errors[0].field).toBe('root');
    });

    it('should reject non-object input', () => {
      const result1 = validateSetupRequest("string");
      expect(result1.isValid).toBe(false);
      expect(result1.errors[0].field).toBe('root');

      const result2 = validateSetupRequest(123);
      expect(result2.isValid).toBe(false);
      expect(result2.errors[0].field).toBe('root');
    });

    describe('Google OAuth validation', () => {
      it('should reject missing google field', () => {
        const invalidData = {
          auth0: validSetupData.auth0,
          app: validSetupData.app
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.field === 'google')).toBe(true);
      });

      it('should reject missing google.clientId', () => {
        const invalidData = {
          ...validSetupData,
          google: {
            clientSecret: validSetupData.google.clientSecret
          }
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.field === 'google.clientId')).toBe(true);
      });

      it('should reject invalid Google Client ID format', () => {
        const invalidData = {
          ...validSetupData,
          google: {
            ...validSetupData.google,
            clientId: "invalid-client-id"
          }
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'google.clientId' && 
          error.message.includes('googleusercontent.com')
        )).toBe(true);
      });


      it('should handle empty strings in Google fields', () => {
        const invalidData = {
          ...validSetupData,
          google: {
            clientId: "",
            clientSecret: ""
          }
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.field === 'google.clientId')).toBe(true);
        expect(result.errors.some(error => error.field === 'google.clientSecret')).toBe(true);
      });
    });

    describe('Auth0 validation', () => {
      it('should reject missing auth0 field', () => {
        const invalidData = {
          google: validSetupData.google,
          app: validSetupData.app
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.field === 'auth0')).toBe(true);
      });

      it('should validate correct Auth0 domain formats', () => {
        const validDomains = [
          "test-domain.auth0.com",
          "my-app.us.auth0.com",
          "eu-app.eu.auth0.com",
          "au-app.au.auth0.com"
        ];

        validDomains.forEach(domain => {
          const testData = {
            ...validSetupData,
            auth0: {
              ...validSetupData.auth0,
              domain
            }
          };
          
          const result = validateSetupRequest(testData);
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject invalid Auth0 domain formats', () => {
        const invalidDomains = [
          "invalid-domain.com",
          "test.myauth0.com",
          "test-domain.auth1.com",
          "auth0.com"
        ];

        invalidDomains.forEach(domain => {
          const invalidData = {
            ...validSetupData,
            auth0: {
              ...validSetupData.auth0,
              domain
            }
          };
          
          const result = validateSetupRequest(invalidData);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(error => error.field === 'auth0.domain')).toBe(true);
        });
      });

      it('should validate Auth0 Client ID length', () => {
        const invalidData = {
          ...validSetupData,
          auth0: {
            ...validSetupData.auth0,
            clientId: "short"
          }
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'auth0.clientId' && 
          error.message.includes('32文字')
        )).toBe(true);
      });

      it('should validate Auth0 Client Secret length', () => {
        const invalidData = {
          ...validSetupData,
          auth0: {
            ...validSetupData.auth0,
            clientSecret: "short"
          }
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'auth0.clientSecret' && 
          error.message.includes('48文字')
        )).toBe(true);
      });
    });

    describe('App configuration validation', () => {
      it('should reject missing app field', () => {
        const invalidData = {
          google: validSetupData.google,
          auth0: validSetupData.auth0
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.field === 'app')).toBe(true);
      });

      it('should reject missing configPassword', () => {
        const invalidData = {
          ...validSetupData,
          app: {}
        };
        
        const result = validateSetupRequest(invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.field === 'app.configPassword')).toBe(true);
      });
    });

  });

  describe('validateConfigPassword', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        "SecurePass123!",
        "MyP@ssw0rd",
        "C0mpl3xP@ss",
        "Str0ng&Secure"
      ];

      strongPasswords.forEach(password => {
        const result = validateConfigPassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject passwords too short', () => {
      const result = validateConfigPassword("Short1!");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('8文字以上'))).toBe(true);
    });

    it('should reject passwords without uppercase', () => {
      const result = validateConfigPassword("lowercase123!");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('大文字'))).toBe(true);
    });

    it('should reject passwords without lowercase', () => {
      const result = validateConfigPassword("UPPERCASE123!");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('小文字'))).toBe(true);
    });

    it('should reject passwords without numbers', () => {
      const result = validateConfigPassword("NoNumbers!");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('数字'))).toBe(true);
    });

    it('should accumulate multiple validation errors', () => {
      const result = validateConfigPassword("weak");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(error => error.includes('8文字以上'))).toBe(true);
      expect(result.errors.some(error => error.includes('大文字'))).toBe(true);
      expect(result.errors.some(error => error.includes('数字'))).toBe(true);
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        "",
        " ",
        "12345678", // numbers only
        "ABCDEFGH", // uppercase only
        "abcdefgh"  // lowercase only
      ];

      edgeCases.forEach(password => {
        const result = validateConfigPassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
});