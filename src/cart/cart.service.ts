import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private productSelect = {
    id: true,
    name: true,
    description: true,
    price: true,
    storeId: true,
    categoryId: true,
    images: { select: { url: true } },
    store: { select: { id: true, name: true } },
    category: { select: { id: true, name: true, slug: true } },
  };

  async ensureProductExists(productId: number): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  async getOrCreateCart(userId: number) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: this.productSelect },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: { select: this.productSelect },
            },
          },
        },
      });
    }

    return this.formatCart(cart);
  }

  private formatCart(cart: {
    id: number;
    userId: number;
    items: Array<{
      id: number;
      productId: number;
      quantity: number;
      product: any;
    }>;
  }) {
    const items = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      product: this.formatProduct(item.product),
    }));

    let subtotal: number | undefined;
    const withPrices = cart.items.every((i) => i.product?.price != null);
    if (withPrices) {
      subtotal = cart.items.reduce((sum, i) => {
        const price = i.product?.price;
        const num = price instanceof Decimal ? price.toNumber() : Number(price);
        return sum + num * i.quantity;
      }, 0);
    }

    return {
      id: cart.id,
      items,
      ...(subtotal !== undefined && { subtotal }),
    };
  }

  private formatProduct(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price ? (p.price.toNumber ? p.price.toNumber() : Number(p.price)) : null,
      storeId: p.storeId,
      categoryId: p.categoryId,
      images: p.images?.map((img: { url: string }) => img.url) ?? [],
      mainImage: p.images?.[0]?.url ?? null,
      store: p.store,
      category: p.category,
    };
  }

  async add(userId: number, dto: AddToCartDto) {
    await this.ensureProductExists(dto.productId);
    const quantity = Math.min(99, Math.max(1, dto.quantity ?? 1));

    return this.prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({ where: { userId } });
      if (!cart) {
        cart = await tx.cart.create({ data: { userId } });
      }

      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_productId: { cartId: cart.id, productId: dto.productId },
        },
      });

      if (existing) {
        const newQty = Math.min(99, existing.quantity + quantity);
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: dto.productId,
            quantity,
          },
        });
      }

      const updated = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: { include: { product: { select: this.productSelect } } },
        },
      });
      return this.formatCart(updated!);
    });
  }

  async update(userId: number, dto: UpdateCartItemDto) {
    if (dto.quantity === 0) {
      return this.remove(userId, dto.productId);
    }
    if (dto.quantity < 1 || dto.quantity > 99) {
      throw new BadRequestException('Invalid quantity');
    }

    await this.ensureProductExists(dto.productId);

    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      const item = await tx.cartItem.findUnique({
        where: {
          cartId_productId: { cartId: cart.id, productId: dto.productId },
        },
      });
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      await tx.cartItem.update({
        where: { id: item.id },
        data: { quantity: dto.quantity },
      });

      const updated = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: { include: { product: { select: this.productSelect } } },
        },
      });
      return this.formatCart(updated!);
    });
  }

  async remove(userId: number, productId: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return this.getOrCreateCart(userId);
    }

    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
    });
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getOrCreateCart(userId);
  }

  async clear(userId: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return { id: 0, items: [], subtotal: 0 };
    }
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.formatCart({ ...cart, items: [] });
  }
}
