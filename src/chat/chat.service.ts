// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtUserPayload } from '../auth/types';
import { CursorDto, PageDto } from './dto/pagination.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ChatGateway } from './chat.gateway';
import { getSupportWelcomeMessageForLang } from './constants/support-welcome-messages';

function parseCursor(cursor?: string) {
  if (!cursor) return null;
  const [createdAt, id] = cursor.split('_');
  const dt = new Date(createdAt);
  if (!createdAt || !id || Number.isNaN(dt.getTime())) return null;
  return { createdAt: dt, id: Number(id) };
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Crear/abrir conversación 1:1 (si existe, la reutiliza).
   * Modelo unificado MRZN:
   * - Si se envía productId: el vendedor real es Product.userId; storeId es opcional (Product.storeId).
   * - Si no hay productId: flujo legacy; otherUserId es el otro participante y storeId/orderId opcionales.
   * Unicidad: una sola conversación por (buyerUserId, sellerUserId, productId).
   */
  async openConversation(user: JwtUserPayload, dto: CreateConversationDto) {
    let buyerUserId = user.id;
    let sellerUserId: number;
    let storeId: number | null;
    let orderId: number | null = dto.orderId ?? null;
    let productId: number | null = dto.productId ?? null;

    if (dto.productId != null) {
      // Flujo por producto: vendedor = Product.userId, storeId opcional
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, userId: true, storeId: true },
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      sellerUserId = product.userId;
      storeId = product.storeId ?? null;
      if (buyerUserId === sellerUserId) {
        throw new BadRequestException('Cannot open a conversation with yourself');
      }
      if (dto.otherUserId != null && dto.otherUserId !== sellerUserId) {
        throw new BadRequestException(
          'otherUserId must match the product seller (Product.userId) when opening by product',
        );
      }
    } else {
      // Flujo legacy: otherUserId obligatorio, storeId/orderId opcionales
      if (dto.otherUserId == null) {
        throw new BadRequestException('otherUserId is required when not opening by productId');
      }
      sellerUserId = dto.otherUserId;
      storeId = dto.storeId ?? null;
      if (buyerUserId === sellerUserId) {
        throw new BadRequestException('Cannot open a conversation with yourself');
      }
    }

    // Evitar duplicados: misma pareja (buyer, seller) y mismo productId (o mismo storeId/orderId en legacy)
    const whereExisting = {
      AND: [
        { participants: { some: { userId: buyerUserId } } },
        { participants: { some: { userId: sellerUserId } } },
      ],
      ...(productId != null
        ? { productId }
        : { productId: null as null, storeId: storeId ?? null, orderId: orderId ?? null }),
    };

    const existing = await this.prisma.conversation.findFirst({
      where: whereExisting,
      include: { participants: true },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        storeId: storeId ?? undefined,
        orderId: orderId ?? undefined,
        productId,
        participants: {
          create: [
            { userId: buyerUserId, role: 'BUYER', lastReadAt: new Date() },
            { userId: sellerUserId, role: 'SELLER' },
          ],
        },
      },
    });
  }

  async listConversations(user: JwtUserPayload, pageDto: PageDto) {
    const { page = 1, pageSize = 20 } = pageDto;

    const [total, convos] = await this.prisma.$transaction([
      this.prisma.conversation.count({
        where: { participants: { some: { userId: user.id } } },
      }),
      this.prisma.conversation.findMany({
        where: { participants: { some: { userId: user.id } } },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          lastMessage: true,
          product: {
            select: {
              id: true,
              name: true,
              // si quieres la imagen principal:
              // images: {
              //   select: { url: true },
              //   take: 1,
              // },
            },
          },
        },
      }),
    ]);

    const result = await Promise.all(
      convos.map(async (c) => {
        const me = c.participants.find((p) => p.userId === user.id);
        const lastReadAt = me?.lastReadAt ?? new Date(0);
        const unread = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            createdAt: { gt: lastReadAt },
            NOT: { senderId: user.id },
          },
        });

        return {
          ...c,
          unread,
        };
      }),
    );

    return {
      data: result,
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    };
  }

  /** Ver mensajes con paginación por cursor */
  async getMessages(
    user: JwtUserPayload,
    conversationId: number,
    cursorDto: CursorDto,
  ) {
    // acceso
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    });
    if (!part) throw new ForbiddenException('Not a participant');

    const cursorParsed = parseCursor(cursorDto.cursor);
    const take = cursorDto.limit ?? 30;

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursorParsed && {
        cursor: {
          conversationId_createdAt_id: {
            conversationId,
            createdAt: cursorParsed.createdAt,
            id: cursorParsed.id,
          },
        } as any,
        skip: 1,
      }),
      include: {
        attachments: true,
        sender: { select: { id: true, name: true } },
      },
    });

    const nextCursor = messages.length
      ? `${messages[messages.length - 1].createdAt.toISOString()}_${messages[messages.length - 1].id}`
      : null;

    return { data: messages, nextCursor };
  }

  /** Enviar texto - VERSIÓN MEJORADA */
  async sendText(user: JwtUserPayload, dto: SendMessageDto) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: dto.conversationId,
          userId: user.id,
        },
      },
    });
    if (!part) throw new ForbiddenException('Not a participant');

    const msg = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId: user.id,
        type: 'TEXT',
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } }, // ✨ Incluir sender para WS
        attachments: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: msg.createdAt, lastMessageId: msg.id },
    });

    // ✨ NUEVO: Emitir por WebSocket PRIMERO
    this.chatGateway.emitNewMessage(dto.conversationId, msg);

    // 🔔 Notificar SOLO a usuarios offline
    const others = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: dto.conversationId, userId: { not: user.id } },
      select: { userId: true },
    });

    await Promise.all(
      others.map(async (o) => {
        // ✨ Solo notificar si está offline
        if (!this.chatGateway.isUserOnline(o.userId)) {
          await this.notifications.create(
            o.userId,
            'NEW_MESSAGE',
            'Nuevo mensaje',
            msg.content ?? '📎 Has recibido un mensaje',
            {
              conversationId: dto.conversationId,
              messageId: msg.id,
              senderId: user.id,
            },
          );
        }
      }),
    );

    return msg;
  }

  /** Adjuntar archivo (imagen o documento) */
  async attachFile(
    user: JwtUserPayload,
    conversationId: number,
    fileInfo: {
      url: string;
      mimeType: string;
      sizeBytes: number;
      width?: number;
      height?: number;
      originalName?: string;
    },
  ) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    });
    if (!part) throw new ForbiddenException('Not a participant');

    const isImage = fileInfo.mimeType.startsWith('image/');

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        type: 'IMAGE',
        content: isImage ? null : (fileInfo.originalName ?? 'file'), // para mostrar nombre en UI
        attachments: {
          create: {
            url: fileInfo.url,
            mimeType: fileInfo.mimeType,
            sizeBytes: fileInfo.sizeBytes,
            width: fileInfo.width,
            height: fileInfo.height,
            // originalName: fileInfo.originalName,
          },
        },
      },
      include: {
        attachments: true,
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: msg.createdAt, lastMessageId: msg.id },
    });

    this.chatGateway.emitNewMessage(conversationId, msg);

    const others = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: user.id } },
      select: { userId: true },
    });

    await Promise.all(
      others.map(async (o) => {
        if (!this.chatGateway.isUserOnline(o.userId)) {
          await this.notifications.create(
            o.userId,
            'NEW_MESSAGE',
            isImage ? 'Nueva imagen' : 'Nuevo archivo',
            isImage ? '📷' : '📎',
            { conversationId, messageId: msg.id, senderId: user.id },
          );
        }
      }),
    );

    return msg;
  }

  /** Mantener compatibilidad para imágenes */
  async attachImage(
    user: JwtUserPayload,
    conversationId: number,
    fileInfo: {
      url: string;
      mimeType: string;
      sizeBytes: number;
      width?: number;
      height?: number;
    },
  ) {
    return this.attachFile(user, conversationId, fileInfo);
  }

  /** Marcar como leído - VERSIÓN MEJORADA */
  async markRead(user: JwtUserPayload, conversationId: number) {
    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    // ✨ NUEVO: Emitir lectura por WebSocket
    this.chatGateway.emitMessageRead(
      conversationId,
      user.id,
      updated.lastReadAt!,
    );

    return { ok: true, at: updated.lastReadAt };
  }

  async deleteConversation(user: JwtUserPayload, conversationId: number) {
    // 1. Verificar acceso
    const part = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!part) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    // 2. Eliminar conversación (cascada elimina mensajes, attachments, etc.)
    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { ok: true };
  }

  /**
   * Obtener o crear la conversación de soporte del usuario autenticado.
   * Estrategia: un admin por conversación (primer usuario con rol ADMIN en BD).
   * Unicidad: una sola conversación de soporte por usuario (supportUserId único).
   * Respuesta compatible con el frontend de chat (conversationId + datos para abrir la conversación).
   * El mensaje de bienvenida solo se crea cuando la conversación es nueva.
   */
  async getOrCreateSupportConversation(
    user: JwtUserPayload,
    lang?: string,
  ) {
    const existing = await this.prisma.conversation.findUnique({
      where: { supportUserId: user.id },
      include: this.supportConversationInclude(),
    });
    if (existing) return this.enrichWithUnread(existing, user.id);

    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!admin) {
      throw new ServiceUnavailableException(
        'No support agent available. Please try again later.',
      );
    }

    try {
      const created = await this.prisma.conversation.create({
        data: {
          isSupport: true,
          supportUserId: user.id,
          participants: {
            create: [
              { userId: user.id, role: 'USER', lastReadAt: new Date() },
              { userId: admin.id, role: 'SUPPORT' },
            ],
          },
        },
      });

      const welcomeMessage = await this.prisma.message.create({
        data: {
          conversationId: created.id,
          senderId: admin.id,
          type: 'SYSTEM',
          content: getSupportWelcomeMessageForLang(lang),
        },
      });

      await this.prisma.conversation.update({
        where: { id: created.id },
        data: {
          lastMessageAt: welcomeMessage.createdAt,
          lastMessageId: welcomeMessage.id,
        },
      });

      await this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: created.id,
            userId: user.id,
          },
        },
        data: {
          lastReadAt: welcomeMessage.createdAt,
        },
      });

      const createdWithRelations = await this.prisma.conversation.findUnique({
        where: { id: created.id },
        include: this.supportConversationInclude(),
      });

      return this.enrichWithUnread(createdWithRelations, user.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const again = await this.prisma.conversation.findUnique({
          where: { supportUserId: user.id },
          include: this.supportConversationInclude(),
        });
        if (again) return this.enrichWithUnread(again, user.id);
      }
      throw e;
    }
  }

  private supportConversationInclude() {
    return {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      lastMessage: true,
      product: { select: { id: true, name: true } },
    } as const;
  }

  private async enrichWithUnread(conversation: any, userId: number) {
    const me = conversation.participants.find((p: any) => p.userId === userId);
    const lastReadAt = me?.lastReadAt ?? new Date(0);
    const unread = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        createdAt: { gt: lastReadAt },
        NOT: { senderId: userId },
      },
    });
    return { ...conversation, unread };
  }

  async listConversationsByStore(
    user: JwtUserPayload,
    storeId: number,
    pageDto: PageDto,
  ) {
    const { page = 1, pageSize = 20 } = pageDto;

    // 1. Verificar que esta tienda pertenece al usuario (owner)
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: user.id,
      },
      select: { id: true },
    });

    if (!store) {
      throw new ForbiddenException('Not owner of this store');
    }

    // 2. Buscar conversaciones de esa tienda en las que participe el usuario
    const [total, convos] = await this.prisma.$transaction([
      this.prisma.conversation.count({
        where: {
          storeId,
          participants: { some: { userId: user.id } },
        },
      }),
      this.prisma.conversation.findMany({
        where: {
          storeId,
          participants: { some: { userId: user.id } },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          lastMessage: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // 3. Calcular "unread" igual que en listConversations
    const result = await Promise.all(
      convos.map(async (c) => {
        const me = c.participants.find((p) => p.userId === user.id);
        const lastReadAt = me?.lastReadAt ?? new Date(0);

        const unread = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            createdAt: { gt: lastReadAt },
            NOT: { senderId: user.id },
          },
        });

        return {
          ...c,
          unread,
        };
      }),
    );

    return {
      data: result,
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    };
  }
}
