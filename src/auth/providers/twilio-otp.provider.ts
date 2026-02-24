import { Injectable, BadRequestException } from '@nestjs/common';
import type { IOtpProvider } from '../interfaces/otp-provider.interface';

const TWILIO_VERIFY_BASE = 'https://verify.twilio.com/v2';

/**
 * Mapea errores de Twilio Verify al contrato OTP (OTP_RATE_LIMIT, OTP_EXPIRED, OTP_TOO_MANY_ATTEMPTS, OTP_INVALID).
 * Referencia: https://www.twilio.com/docs/verify/api/v1/return-and-error-codes
 * - 20429: Too many requests -> OTP_RATE_LIMIT
 * - 60202: Max check attempts reached -> OTP_TOO_MANY_ATTEMPTS
 * - 60203: Max send attempts reached -> OTP_RATE_LIMIT
 * - 60410 / 404: Verification not found or expired -> OTP_EXPIRED
 * - 60222 / 400: Incorrect code -> OTP_INVALID
 */
function mapTwilioErrorToOtpCode(
  status: number,
  twilioCode: number | undefined,
): { code: string; message: string } {
  switch (twilioCode) {
    case 60202:
      return {
        code: 'OTP_TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Request a new code.',
      };
    case 60203:
      return {
        code: 'OTP_RATE_LIMIT',
        message: 'Too many OTP requests for this phone. Try again later.',
      };
    case 60410:
    case 60223:
      return {
        code: 'OTP_EXPIRED',
        message: 'OTP expired or already used.',
      };
    case 60222:
      return {
        code: 'OTP_INVALID',
        message: 'Invalid OTP code.',
      };
    default:
      if (status === 429) {
        return {
          code: 'OTP_RATE_LIMIT',
          message: 'Too many OTP requests for this phone. Try again later.',
        };
      }
      if (status === 404) {
        return { code: 'OTP_EXPIRED', message: 'OTP expired or already used.' };
      }
      return {
        code: 'OTP_INVALID',
        message: 'Invalid OTP code.',
      };
  }
}

@Injectable()
export class TwilioOtpProvider implements IOtpProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly serviceSid: string;
  private readonly basicAuth: string;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
    const token = process.env.TWILIO_AUTH_TOKEN ?? '';
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID ?? '';
    this.accountSid = sid;
    this.authToken = token;
    this.serviceSid = serviceSid;
    this.basicAuth = sid && token ? Buffer.from(`${sid}:${token}`).toString('base64') : '';
  }

  private ensureConfig(): void {
    if (!this.serviceSid || !this.basicAuth) {
      throw new Error(
        'TwilioOtpProvider requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID when OTP_PROVIDER=twilio',
      );
    }
  }

  async requestOtp(phone: string): Promise<{ success: boolean; devOtp?: string }> {
    this.ensureConfig();
    const url = `${TWILIO_VERIFY_BASE}/Services/${this.serviceSid}/Verifications`;
    const body = new URLSearchParams({ To: phone, Channel: 'sms' });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        code?: number;
        message?: string;
      };
      const mapped = mapTwilioErrorToOtpCode(res.status, data.code);
      throw new BadRequestException(mapped);
    }

    return { success: true };
  }

  async verifyCode(phone: string, code: string): Promise<void> {
    this.ensureConfig();
    const url = `${TWILIO_VERIFY_BASE}/Services/${this.serviceSid}/VerificationCheck`;
    const body = new URLSearchParams({ To: phone, Code: code });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        code?: number;
        message?: string;
      };
      const mapped = mapTwilioErrorToOtpCode(res.status, data.code);
      throw new BadRequestException(mapped);
    }

    const data = (await res.json()) as { status?: string };
    if (data.status !== 'approved') {
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Invalid OTP code.',
      });
    }
  }
}
