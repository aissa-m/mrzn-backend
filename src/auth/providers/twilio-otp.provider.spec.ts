import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TwilioOtpProvider } from './twilio-otp.provider';

const originalEnv = process.env;

describe('TwilioOtpProvider', () => {
  let provider: TwilioOtpProvider;

  const phone = '+34600000000';
  const code = '123456';

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'test-token',
      TWILIO_VERIFY_SERVICE_SID: 'VAtest',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TwilioOtpProvider],
    }).compile();

    provider = module.get<TwilioOtpProvider>(TwilioOtpProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('requestOtp', () => {
    it('should return success when Twilio accepts', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'pending' }),
      } as Response);

      const result = await provider.requestOtp(phone);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/Verifications'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw OTP_RATE_LIMIT when Twilio returns 429', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ code: 20429 }),
      } as Response);

      let err: any;
      try {
        await provider.requestOtp(phone);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_RATE_LIMIT');
    });
  });

  describe('verifyCode', () => {
    it('should resolve when Twilio returns approved', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'approved' }),
      } as Response);

      await expect(provider.verifyCode(phone, code)).resolves.toBeUndefined();
    });

    it('should throw OTP_EXPIRED when Twilio returns 404', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ code: 60410 }),
      } as Response);

      let err: any;
      try {
        await provider.verifyCode(phone, code);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_EXPIRED');
    });

    it('should throw OTP_INVALID for wrong code (60222)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ code: 60222 }),
      } as Response);

      let err: any;
      try {
        await provider.verifyCode(phone, '999999');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_INVALID');
    });

    it('should throw OTP_TOO_MANY_ATTEMPTS for 60202', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ code: 60202 }),
      } as Response);

      let err: any;
      try {
        await provider.verifyCode(phone, code);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_TOO_MANY_ATTEMPTS');
    });
  });

  describe('ensureConfig', () => {
    it('should throw when env vars missing and methods called', async () => {
      process.env.TWILIO_ACCOUNT_SID = '';
      process.env.TWILIO_AUTH_TOKEN = '';
      process.env.TWILIO_VERIFY_SERVICE_SID = '';

      const module2 = await Test.createTestingModule({
        providers: [TwilioOtpProvider],
      }).compile();
      const providerNoConfig = module2.get<TwilioOtpProvider>(TwilioOtpProvider);

      await expect(providerNoConfig.requestOtp(phone)).rejects.toThrow(
        /TWILIO_ACCOUNT_SID.*TWILIO_VERIFY_SERVICE_SID/,
      );
    });
  });
});
