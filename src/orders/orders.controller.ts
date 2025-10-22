import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client'; // si tu enum Role está en Prisma
// Si tu enum Role es local, cambia el import a tu ruta local de types

@Controller('orders')
@UseGuards(JwtAuthGuard) // por defecto todas requieren login, salvo que expongas alguna pública
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * ADMIN: Listado general de pedidos
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.ordersService.findAll();
  }

  /**
   * USER: Listar pedidos del usuario autenticado
   */
  @Get('my')
  findMine(@CurrentUser() user: { id: number }) {
    return this.ordersService.findByUser(user.id);
  }

  /**
   * STORE_OWNER / ADMIN: Listar pedidos de una tienda concreta
   * - Requiere que el owner sea propietario de esa tienda o que sea ADMIN.
   * - La comprobación fina la hace el servicio con OwnershipService (o tu StoreOwnerGuard si lo prefieres).
   */
  @Get('store/:storeId')
  @UseGuards(RolesGuard)
  @Roles(Role.STORE_OWNER, Role.ADMIN)
  findByStore(@Param('storeId', ParseIntPipe) storeId: number, @CurrentUser() user: { id: number; role?: Role }) {
    return this.ordersService.findByStore(storeId, user);
  }

  /**
   * USER: Obtener un pedido por id si el usuario es el dueño,
   *        o si es el dueño de la tienda asociada, o ADMIN.
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; role?: Role }) {
    return this.ordersService.findOneAccessible(id, user);
  }

  /**
   * USER: Crear un pedido (sin carrito). Todos los items deben ser de la misma tienda (modelo Wallapop).
   */
  @Post()
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  /**
   * STORE_OWNER / ADMIN: Actualizar el estado de un pedido (PAID, SHIPPED, COMPLETED, CANCELED)
   * - La validación de transición de estados debe estar en el servicio.
   * - No forzamos DTO aquí para no romper tu flujo; el servicio valida el `status`.
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.STORE_OWNER, Role.ADMIN)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'PENDING' | 'PAID' | 'CANCELED' | 'SHIPPED' | 'COMPLETED' },
    @CurrentUser() user: { id: number; role?: Role },
  ) {
    return this.ordersService.updateStatus(id, body.status, user);
  }

  /**
   * USER: Cancelar su propio pedido (si está en PENDING).
   * STORE_OWNER / ADMIN: también podrán cancelar según reglas del servicio.
   * - Usamos PATCH semántico para "acción" en lugar de DELETE (que sería borrado duro).
   */
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; role?: Role }) {
    return this.ordersService.cancel(id, user);
  }

  /**
   * ADMIN: Borrado duro del pedido (p. ej., para limpieza de datos en testing).
   * - En producción casi siempre preferirás cancelación o soft delete.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
