import { Controller, Get } from '@nestjs/common';
import { MAURITANIA_WILAYAS } from './data/mauritania-locations';

/**
 * Respuesta del endpoint de ubicaciones de Mauritania.
 * Wilayas (regiones) con sus moughataas (departamentos) para selects dependientes en onboarding de tienda.
 */
export interface MauritaniaLocationsResponse {
  country: 'MR';
  wilayas: Array<{
    code: string;
    name: string;
    moughataas: Array<{ code: string; name: string }>;
  }>;
}

@Controller('locations')
export class LocationsController {
  /**
   * Devuelve wilayas (regiones) y moughataas (departamentos) de Mauritania.
   * El frontend puede usar este payload para selects dependientes: región → departamento.
   * Estructura versionable en código (mauritania-locations.ts).
   */
  @Get('mauritania')
  getMauritania(): MauritaniaLocationsResponse {
    return {
      country: 'MR',
      wilayas: MAURITANIA_WILAYAS.map((w) => ({
        code: w.code,
        name: w.name,
        moughataas: w.moughataas.map((m) => ({ code: m.code, name: m.name })),
      })),
    };
  }
}
