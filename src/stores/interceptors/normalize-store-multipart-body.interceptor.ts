import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Multer/busboy suele dejar valores de texto como string, pero también como:
 * - string[] si el cliente repite el nombre del campo
 * - Buffer en algunos entornos
 * - string con JSON serializado (ej. "\"Super\"" o '["Super"]')
 *
 * Este interceptor deja `req.body` con el mismo shape que un JSON típico antes del ValidationPipe.
 */
@Injectable()
export class NormalizeStoreMultipartBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: Record<string, unknown>;
    }>();
    const ct = req.headers['content-type'];
    const contentType = Array.isArray(ct) ? ct[0] : ct ?? '';
    if (
      typeof contentType === 'string' &&
      contentType.includes('multipart/form-data') &&
      req.body &&
      typeof req.body === 'object' &&
      !Array.isArray(req.body)
    ) {
      const dto = req.body;
      console.log('BODY RAW /stores:', dto);
      console.log('BODY NAME TYPE:', typeof dto?.name, dto?.name);
      for (const key of Object.keys(dto)) {
        dto[key] = this.coerceFieldValue(dto[key]);
      }
    }
    return next.handle();
  }

  private coerceFieldValue(value: unknown): unknown {
    if (value === undefined || value === null) {
      return value;
    }
    if (Buffer.isBuffer(value)) {
      return this.normalizeString(value.toString('utf8'));
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return undefined;
      }
      return this.coerceFieldValue(value[0]);
    }
    if (typeof value === 'string') {
      return this.normalizeString(value);
    }
    return value;
  }

  private normalizeString(raw: string): string {
    let s = raw.trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = s.slice(1, -1).trim();
    }
    if (
      (s.startsWith('[') && s.endsWith(']')) ||
      (s.startsWith('{') && s.endsWith('}'))
    ) {
      try {
        const parsed: unknown = JSON.parse(s);
        if (typeof parsed === 'string') {
          return parsed.trim();
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (typeof first === 'string') {
            return first.trim();
          }
        }
      } catch {
        /* no es JSON */
      }
    }
    return s;
  }
}
