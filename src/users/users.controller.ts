import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UpdateMeDto } from './dto/update-me.dto';
import { MeProfileResponseDto } from './dto/me-profile-response.dto';
import { MeAccountResponseDto } from './dto/me-account-response.dto';
import { QueryMyTransactionsDto } from './dto/query-my-transactions.dto';
import { QueryPublicProfileDto } from './dto/query-public-profile.dto';
import { PublicProfileResponseDto } from './dto/public-profile-response.dto';
import { PaginatedTransactionsResponseDto } from './dto/paginated-transactions-response.dto';
import { TransactionDetailResponseDto } from './dto/transaction-detail-response.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: MeProfileResponseDto, description: 'Perfil ligero del usuario autenticado (incluye phone)' })
  getMeProfile(@CurrentUser() user: { id: number }): Promise<MeProfileResponseDto> {
    return this.usersService.getMeProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/public-profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'My public profile (mobile)',
    description:
      'Vista "mi perfil público / mis productos": datos básicos del usuario (sin email/phone/nni/dirección), rating/reviewsCount (null/0), estadísticas (productsCount, salesCount, purchasesCount) y lista paginada de productos del usuario. lastActiveAt, responseTime, responseRate no existen en BD y se devuelven como null.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 20 })
  @ApiResponse({ status: 200, description: 'Perfil público con productos paginados', type: PublicProfileResponseDto })
  getPublicProfile(
    @CurrentUser() user: { id: number },
    @Query() query: QueryPublicProfileDto,
  ): Promise<PublicProfileResponseDto> {
    return this.usersService.getPublicProfile(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: MeAccountResponseDto, description: 'Cuenta del usuario autenticado (incluye phone)' })
  me(@CurrentUser() user: { id: number }) {
    return this.usersService.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: MeAccountResponseDto })
  updateMe(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateMeDto,
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/personal-info')
  clearPersonalInfo(@CurrentUser() user: { id: number }) {
    return this.usersService.clearPersonalInfo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/purchases')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List my purchases (orders where I am the buyer)',
    description:
      'Paginated list of orders where userId === current user. Optional filter by status: in_progress (PENDING, PAID, SHIPPED) or completed (COMPLETED, CANCELED).',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['in_progress', 'completed', 'all'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated purchases', type: PaginatedTransactionsResponseDto })
  getMyPurchases(
    @CurrentUser() user: { id: number },
    @Query() query: QueryMyTransactionsDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.usersService.getMyPurchases(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/sales')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List my sales (orders from my stores)',
    description:
      'Paginated list of orders from stores owned by the current user. Optional filter by status: in_progress or completed.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['in_progress', 'completed', 'all'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated sales', type: PaginatedTransactionsResponseDto })
  getMySales(
    @CurrentUser() user: { id: number },
    @Query() query: QueryMyTransactionsDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.usersService.getMySales(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/transactions/:id')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get transaction detail by ID',
    description:
      'Returns detail of a single transaction (purchase or sale) for the authenticated user. Access allowed only if the user is the buyer (Order.userId) or the seller (Store.ownerId). Returns 404 if the order does not exist or does not belong to the user.',
  })
  @ApiParam({ name: 'id', description: 'Order/transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction detail', type: TransactionDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found or not accessible' })
  getTransactionById(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
  ): Promise<TransactionDetailResponseDto> {
    return this.usersService.getTransactionById(user.id, parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (req, file, cb) => {
          // 👇 sacamos el userId a mano
          const userId = (req as any).user?.id;
          const ext = extname(file.originalname);
          const fileName = `${userId}-${Date.now()}${ext}`;
          cb(null, fileName);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any, // 👈 sencillo: any aquí
  ) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const user = await this.usersService.updateAvatar(req.user.id, avatarUrl);
    return user;
  }
}
