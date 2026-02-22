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
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get cart (creates if not exists)' })
  @ApiResponse({ status: 200, description: 'Cart with items and optional subtotal' })
  getCart(@CurrentUser() user: { id: number }) {
    return this.cartService.getOrCreateCart(user.id);
  }

  @Post('add')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add item or increment quantity (upsert by cartId, productId)' })
  @ApiResponse({ status: 200, description: 'Updated cart' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  add(@CurrentUser() user: { id: number }, @Body() dto: AddToCartDto) {
    return this.cartService.add(user.id, dto);
  }

  @Patch('update')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Set item quantity; if quantity is 0, item is removed' })
  @ApiResponse({ status: 200, description: 'Updated cart' })
  @ApiResponse({ status: 404, description: 'Product not found or Cart item not found' })
  @ApiResponse({ status: 400, description: 'Invalid quantity' })
  update(@CurrentUser() user: { id: number }, @Body() dto: UpdateCartItemDto) {
    return this.cartService.update(user.id, dto);
  }

  @Delete('remove/:productId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Remove item by productId' })
  @ApiResponse({ status: 200, description: 'Updated cart' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  remove(
    @CurrentUser() user: { id: number },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.cartService.remove(user.id, productId);
  }

  @Delete('clear')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Empty the cart' })
  @ApiResponse({ status: 200, description: 'Empty cart' })
  clear(@CurrentUser() user: { id: number }) {
    return this.cartService.clear(user.id);
  }
}
