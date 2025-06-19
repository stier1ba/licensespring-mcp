import {
  generateLicenseApiSignature,
  generateLicenseApiAuthHeader,
  generateManagementApiAuthHeader,
  validateLicenseApiAuth,
  validateManagementApiAuth
} from '../auth';

describe('Auth Utils', () => {
  describe('generateLicenseApiSignature', () => {
    it('should generate a valid HMAC-SHA256 signature', () => {
      const sharedKey = 'test-shared-key';
      const apiKey = 'test-api-key';
      const date = 'Mon, 19 Oct 2020 15:42:27 GMT';
      
      const signature = generateLicenseApiSignature(sharedKey, apiKey, date);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should generate different signatures for different inputs', () => {
      const sharedKey = 'test-shared-key';
      const apiKey = 'test-api-key';
      const date1 = 'Mon, 19 Oct 2020 15:42:27 GMT';
      const date2 = 'Tue, 20 Oct 2020 15:42:27 GMT';
      
      const signature1 = generateLicenseApiSignature(sharedKey, apiKey, date1);
      const signature2 = generateLicenseApiSignature(sharedKey, apiKey, date2);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should include license key and hardware ID in offline signature', () => {
      const sharedKey = 'test-shared-key';
      const apiKey = 'test-api-key';
      const date = 'Mon, 19 Oct 2020 15:42:27 GMT';
      const licenseKey = 'TEST-LICENSE-KEY';
      const hardwareId = 'test-hardware-id';
      
      const signature1 = generateLicenseApiSignature(sharedKey, apiKey, date);
      const signature2 = generateLicenseApiSignature(sharedKey, apiKey, date, licenseKey, hardwareId);
      
      expect(signature1).not.toBe(signature2);
    });
  });

  describe('generateLicenseApiAuthHeader', () => {
    it('should generate auth header with date and authorization', () => {
      const sharedKey = 'test-shared-key';
      const apiKey = 'test-api-key';
      
      const { date, authorization } = generateLicenseApiAuthHeader(sharedKey, apiKey);
      
      expect(date).toBeDefined();
      expect(authorization).toBeDefined();
      expect(authorization).toContain('algorithm="hmac-sha256"');
      expect(authorization).toContain('headers="date"');
      expect(authorization).toContain(`apikey="${apiKey}"`);
      expect(authorization).toContain('signature=');
    });

    it('should generate valid date format', () => {
      const sharedKey = 'test-shared-key';
      const apiKey = 'test-api-key';
      
      const { date } = generateLicenseApiAuthHeader(sharedKey, apiKey);
      
      // Should be a valid UTC date string
      expect(new Date(date).toUTCString()).toBe(date);
    });
  });

  describe('generateManagementApiAuthHeader', () => {
    it('should generate correct management API auth header', () => {
      const apiKey = 'test-management-api-key';
      
      const authHeader = generateManagementApiAuthHeader(apiKey);
      
      expect(authHeader).toBe(`Api-Key ${apiKey}`);
    });
  });

  describe('validateLicenseApiAuth', () => {
    it('should not throw for valid credentials', () => {
      expect(() => {
        validateLicenseApiAuth('api-key', 'shared-key');
      }).not.toThrow();
    });

    it('should throw for missing API key', () => {
      expect(() => {
        validateLicenseApiAuth(undefined, 'shared-key');
      }).toThrow('LICENSE_API_KEY is required');
    });

    it('should not throw for missing shared key (graceful degradation)', () => {
      expect(() => {
        validateLicenseApiAuth('api-key', undefined);
      }).not.toThrow();
    });
  });

  describe('validateManagementApiAuth', () => {
    it('should not throw for valid API key', () => {
      expect(() => {
        validateManagementApiAuth('management-api-key');
      }).not.toThrow();
    });

    it('should throw for missing API key', () => {
      expect(() => {
        validateManagementApiAuth(undefined);
      }).toThrow('MANAGEMENT_API_KEY is required');
    });
  });
});
