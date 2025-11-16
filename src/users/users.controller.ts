import {
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: number }) {
    return this.usersService.getMe(user.id);
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
