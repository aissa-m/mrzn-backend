// src/chat/chat.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CursorDto, PageDto } from './dto/pagination.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import * as fs from 'fs';

function ensureDir(path: string) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
}

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'chat');
ensureDir(UPLOAD_DIR);

const storage = diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = randomBytes(16).toString('hex');
    cb(null, `${Date.now()}_${id}${extname(file.originalname)}`);
  },
});

// Solo imágenes (para el endpoint antiguo)
function imageFileFilter(_req: any, file: Express.Multer.File, cb: any) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new BadRequestException('Invalid image type'), false);
  }
  cb(null, true);
}

// Imágenes + algunos documentos (para attachments)
function attachmentFileFilter(_req: any, file: Express.Multer.File, cb: any) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new BadRequestException('Unsupported file type'), false);
  }
  cb(null, true);
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  open(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chat.openConversation(user, dto);
  }

  @Get('store/:storeId/conversations')
  listByStore(
    @CurrentUser() user: JwtUserPayload,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query() page: PageDto,
  ) {
    return this.chat.listConversationsByStore(user, storeId, page);
  }

  @Get('conversations')
  list(@CurrentUser() user: JwtUserPayload, @Query() page: PageDto) {
    return this.chat.listConversations(user, page);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Query() cursor: CursorDto,
  ) {
    return this.chat.getMessages(user, id, cursor);
  }

  @Post('messages')
  sendText(@CurrentUser() user: JwtUserPayload, @Body() dto: SendMessageDto) {
    return this.chat.sendText(user, dto);
  }

  @Post('conversations/:id/read')
  markRead(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chat.markRead(user, id);
  }

  /** 🔵 Endpoint antiguo, solo imagen, local */
  @Post('conversations/:id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) conversationId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const url = `/uploads/chat/${file.filename}`;

    return this.chat.attachImage(user, conversationId, {
      url,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  }

  @Delete('conversations/:id')
  deleteConversation(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chat.deleteConversation(user, id);
  }

  /** 🟢 Nuevo endpoint genérico: imágenes + documentos */
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter: attachmentFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) conversationId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const url = `/uploads/chat/${file.filename}`;

    return this.chat.attachFile(user, conversationId, {
      url,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      originalName: file.originalname,
    });
  }
}
