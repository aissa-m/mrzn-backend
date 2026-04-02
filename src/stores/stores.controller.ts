import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUserPayload } from '../auth/types/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StoreBrandUploadFiles } from './types/store-upload-files.type';
import { NormalizeStoreMultipartBodyInterceptor } from './interceptors/normalize-store-multipart-body.interceptor';

const STORE_BRAND_MAX_BYTES = 5 * 1024 * 1024;

const storeBrandImageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const mime = file.mimetype || '';
  if (!mime.startsWith('image/')) {
    return cb(
      new BadRequestException('Tipo de archivo no permitido para logo o banner'),
      false,
    );
  }
  cb(null, true);
};

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // Listado público de tiendas (incluye número de productos)
  @Get()
  findAll() {
    return this.storesService.findAll();
  }

  // Crear tienda (cualquier usuario autenticado; máximo una por cuenta)
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      {
        limits: { fileSize: STORE_BRAND_MAX_BYTES },
        fileFilter: storeBrandImageFileFilter,
      },
    ),
    NormalizeStoreMultipartBodyInterceptor,
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    description:
      'JSON (application/json) o multipart: mismos campos de texto; opcionalmente archivos logo y banner (imagen). Las subidas rellenan logoUrl y bannerUrl en el servidor.',
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        businessType: { type: 'string' },
        logoUrl: { type: 'string' },
        bannerUrl: { type: 'string' },
        logoImageUrl: { type: 'string' },
        coverImageUrl: { type: 'string' },
        phoneLocalPart: { type: 'string' },
        logo: { type: 'string', format: 'binary' },
        banner: { type: 'string', format: 'binary' },
      },
    },
  })
  create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateStoreDto,
    @UploadedFiles() files?: StoreBrandUploadFiles,
  ) {
    return this.storesService.create(user.id, dto, files);
  }

  // Mis tiendas (array; compatible con cliente actual)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@CurrentUser() user: { id: number }) {
    return this.storesService.findAllByOwner(user.id);
  }

  // Contexto de vendedor: sellerMode, store, canPublishAsStore
  @UseGuards(JwtAuthGuard)
  @Get('me/context')
  getMySellerContext(@CurrentUser() user: { id: number }) {
    return this.storesService.getMySellerContext(user.id);
  }

  // Pública: detalle de tienda (si prefieres, protégelo)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(Number(id));
  }

  // Editar: JwtAuth + comprobación de ownerId (o ADMIN) en servicio — no usar RolesGuard aquí:
  // tras POST /stores el usuario suele seguir con role USER en el JWT hasta renovar token.
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      {
        limits: { fileSize: STORE_BRAND_MAX_BYTES },
        fileFilter: storeBrandImageFileFilter,
      },
    ),
    NormalizeStoreMultipartBodyInterceptor,
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    description:
      'JSON o multipart: campos opcionales de texto; archivos logo/banner sustituyen o definen logoUrl/bannerUrl tras subida.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        logoUrl: { type: 'string' },
        bannerUrl: { type: 'string' },
        logoImageUrl: { type: 'string' },
        coverImageUrl: { type: 'string' },
        logo: { type: 'string', format: 'binary' },
        banner: { type: 'string', format: 'binary' },
      },
    },
  })
  update(
    @CurrentUser() user: JwtUserPayload | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @UploadedFiles() files?: StoreBrandUploadFiles,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    const storeId = Math.trunc(Number(id));
    const role = (user.role ?? 'USER') as 'USER' | 'STORE_OWNER' | 'ADMIN';

    console.log('\n========== [StoresController.update] PATCH /stores/:id (antes del servicio) ==========');
    console.log('request.user completo:', JSON.stringify({ ...user, id: user.id, role: user.role }));
    console.log('request.user.id:', user.id, '| typeof:', typeof user.id);
    console.log('request.user.role:', user.role);
    console.log('param id (string):', id);
    console.log('storeId coerción (Math.trunc Number):', storeId, '| válido:', Number.isFinite(storeId) && storeId >= 1);

    if (!Number.isFinite(storeId) || storeId < 1) {
      console.log('RESULTADO: 400 — param :id no es un id de tienda válido');
      console.log('================================================================================\n');
      throw new BadRequestException('Identificador de tienda inválido');
    }

    return this.storesService.update(
      {
        id: user.id,
        role,
      },
      storeId,
      dto,
      files,
    );
  }

  // Borrar: misma política que PATCH (propiedad en servicio).
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: JwtUserPayload | undefined, @Param('id') id: string) {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.storesService.remove(
      {
        id: user.id,
        role: (user.role ?? 'USER') as 'USER' | 'STORE_OWNER' | 'ADMIN',
      },
      Number(id),
    );
  }
}
