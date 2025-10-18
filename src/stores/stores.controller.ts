import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // Crear tienda (STORE_OWNER o ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateStoreDto) {
    return this.storesService.create(user.id, dto);
  }

  // Mis tiendas
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@CurrentUser() user: any) {
    return this.storesService.findAllByOwner(user.id);
  }

  // Pública: detalle de tienda (si prefieres, protégelo)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(Number(id));
  }

  // Editar (dueño o admin — el admin pasa RolesGuard y puede saltarse ownership si lo prefieres)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.update(user.id, Number(id), dto);
  }

  // Borrar
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.storesService.remove(user.id, Number(id));
  }
}
