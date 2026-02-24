/**
 * Abstracción para proveedores OTP intercambiables (local, Twilio Verify, etc.).
 * El provider solo se encarga de solicitar y verificar el código; la creación
 * de usuario y JWT quedan en OtpService.
 *
 * verifyCode debe lanzar BadRequestException con response.code en:
 * OTP_RATE_LIMIT | OTP_EXPIRED | OTP_TOO_MANY_ATTEMPTS | OTP_INVALID
 */
export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

export interface IOtpProvider {
  /**
   * Solicita el envío/generación de OTP para el teléfono (ya normalizado).
   * @throws BadRequestException con code OTP_RATE_LIMIT si aplica
   */
  requestOtp(phone: string): Promise<{ success: boolean; devOtp?: string }>;

  /**
   * Verifica el código OTP. Resuelve si es válido.
   * @throws BadRequestException con code OTP_EXPIRED | OTP_TOO_MANY_ATTEMPTS | OTP_INVALID
   */
  verifyCode(phone: string, code: string): Promise<void>;
}
