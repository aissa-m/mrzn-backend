import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as rolesGuard from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { QueryOrdersDto } from './dto/query-orders.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard) // por defecto todas requieren login, salvo que expongas alguna pública
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * ADMIN: Listado general de pedidos
   */
  @Get()
  @UseGuards(rolesGuard.RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('my')
  findMine(@CurrentUser() user: { id: number }) {
    return this.ordersService.findByUser(user.id);
  }


  @Get('store/:storeId')
  @UseGuards(rolesGuard.RolesGuard)
  @Roles(Role.STORE_OWNER, Role.ADMIN)
  findByStore(@Param('storeId', ParseIntPipe) storeId: number, @CurrentUser() user: { id: number; role?: Role }) {
    return this.ordersService.findByStore(storeId, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; role?: Role }) {
    return this.ordersService.findOneAccessible(id, user);
  }

  @Post()
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Patch(':id/status')
  @UseGuards(rolesGuard.RolesGuard)
  @Roles(Role.STORE_OWNER, Role.ADMIN)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'PENDING' | 'PAID' | 'CANCELED' | 'SHIPPED' | 'COMPLETED' },
    @CurrentUser() user: { id: number; role?: Role },
  ) {
    return this.ordersService.updateStatus(id, body.status, user);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; role?: Role }) {
    return this.ordersService.cancel(id, user);
  }

  @Delete(':id')
  @UseGuards(rolesGuard.RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }

  @Get()
  findMany(
    @CurrentUser() user: rolesGuard.JwtUserPayload,
    @Query() dto: QueryOrdersDto,
  ) {
    return this.ordersService.findMany(user, dto);
  }

}
