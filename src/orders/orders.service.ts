import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OwnershipService } from '../common/services/ownership.service';
import { OrderStatus, Role } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  // ====== CREATE ======
  async create(userId: number, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir al menos un producto.');
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, storeId: true },
    });

    if (products.length !== dto.items.length) {
      throw new NotFoundException('Uno o más productos no existen.');
    }

    // Reglas tipo Wallapop: todos los items de la misma tienda
    const storeId = products[0].storeId;
    if (!products.every((p) => p.storeId === storeId)) {
      throw new BadRequestException(
        'Todos los productos deben pertenecer a la misma tienda.',
      );
    }

    const itemsData = dto.items.map((item) => {
      const p = products.find((x) => x.id === item.productId)!;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: Number(p.price), // Product.price es Decimal(10,2)
      };
    });

    const total = itemsData.reduce(
      (acc, it) => acc + it.price * it.quantity,
      0,
    );

    // Transacción: crea Order + OrderItems
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          storeId,
          total,
          status: OrderStatus.PENDING,
        },
      });

      await tx.orderItem.createMany({
        data: itemsData.map((i) => ({ ...i, orderId: created.id })),
      });

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true, store: true, user: true },
      });
    });

    return order;
  }

  // ====== READ ======
  async findAll() {
    // Uso típico: ADMIN
    return this.prisma.order.findMany({
      include: { items: true, store: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, store: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStore(
    storeId: number,
    user: { id: number; role?: Role },
  ) {
    // Permitir si ADMIN o si es owner de la tienda
    if (user.role !== Role.ADMIN) {
      const owns = await this.ownership.userOwnsStore(user.id, storeId);
      if (!owns) {
        throw new ForbiddenException(
          'No tienes permisos para ver pedidos de esta tienda.',
        );
      }
    }

    return this.prisma.order.findMany({
      where: { storeId },
      include: { items: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneAccessible(
    id: number,
    user: { id: number; role?: Role },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, user: true, store: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado.');

    const isBuyer = order.userId === user.id;
    const isStoreOwner =
      user.role !== Role.ADMIN &&
      (await this.ownership.userOwnsStore(user.id, order.storeId));

    if (!(isBuyer || isStoreOwner || user.role === Role.ADMIN)) {
      throw new ForbiddenException('No tienes acceso a este pedido.');
    }

    return order;
    }

  // ====== UPDATE STATUS ======
  async updateStatus(
    id: number,
    status: OrderStatus,
    user: { id: number; role?: Role },
  ) {
    // Validar enum
    if (!Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException('Estado no válido.');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { store: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado.');

    // Permisos: STORE_OWNER de esa tienda o ADMIN
    if (user.role !== Role.ADMIN) {
      const owns = await this.ownership.userOwnsStore(user.id, order.storeId);
      if (!owns) {
        throw new ForbiddenException(
          'No puedes modificar el estado de este pedido.',
        );
      }
    }

    // Reglas simples de transición (ajústalas a tu negocio)
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELED, OrderStatus.COMPLETED],
      [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELED]: [],
    };

    if (!allowed[order.status].includes(status)) {
      throw new BadRequestException(
        `Transición inválida: ${order.status} -> ${status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true, user: true, store: true },
    });

    return updated;
  }

  // ====== CANCEL ======
  async cancel(id: number, user: { id: number; role?: Role }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado.');

    const isBuyer = order.userId === user.id;

    // Buyer puede cancelar si está en PENDING
    if (isBuyer) {
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          'Solo puedes cancelar pedidos en estado PENDING.',
        );
      }
    } else if (user.role !== Role.ADMIN) {
      // Store owner puede cancelar si es su tienda
      const owns = await this.ownership.userOwnsStore(user.id, order.storeId);
      if (!owns) {
        throw new ForbiddenException(
          'No puedes cancelar este pedido.',
        );
      }
      // (opcional) restringir qué estados puede cancelar el propietario
      if (![OrderStatus.PENDING, OrderStatus.PAID].includes(order.status)) {
        throw new BadRequestException(
          'Este pedido no puede cancelarse en su estado actual.',
        );
      }
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELED },
      include: { items: true, user: true, store: true },
    });
  }

  // ====== DELETE (ADMIN) ======
  async remove(id: number) {
    // Borrado duro (testing / mantenimiento)
    // Elimina primero los items para cumplir FK
    await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
    const deleted = await this.prisma.order.delete({
      where: { id },
      include: { items: true, user: true, store: true },
    });
    return deleted;
  }
}
