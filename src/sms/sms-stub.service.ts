import { Injectable } from '@nestjs/common';
import { ISmsService } from './sms.interface';

/**
 * Stub de envío SMS: solo loguea en consola.
 * En producción reemplazar por implementación real (Twilio, etc.).
 */
@Injectable()
export class SmsStubService implements ISmsService {
  async sendOtp(phone: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[SmsStub] OTP para ${phone}: ${code}`);
  }
}
