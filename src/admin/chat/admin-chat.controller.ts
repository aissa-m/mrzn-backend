import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../auth/types/auth.types';
import { ChatService } from '../../chat/chat.service';
import { PageDto } from '../../chat/dto/pagination.dto';

@ApiTags('admin')
@Controller('admin/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('support/conversations')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List support conversations (admin)',
    description:
      'Returns paginated list of support conversations (isSupport = true), ordered by lastMessageAt desc. Includes supportUser (user who opened the ticket) and unread count for the current admin.',
  })
  @ApiResponse({ status: 200, description: 'Paginated support conversations.' })
  @ApiResponse({ status: 403, description: 'Forbidden – not ADMIN.' })
  listSupportConversations(
    @CurrentUser() user: JwtUserPayload,
    @Query() pageDto: PageDto,
  ) {
    return this.chatService.listSupportConversationsForAdmin(user, pageDto);
  }
}
