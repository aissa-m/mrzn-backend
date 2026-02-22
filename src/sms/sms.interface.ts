/**
 * Interfaz desacoplada para envío de SMS (OTP).
 * Implementaciones: SmsStubService (dev), Twilio, etc.
 */
export const SMS_SERVICE = Symbol('SMS_SERVICE');

export interface ISmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}
