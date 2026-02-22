import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminBootstrapGuard } from './admin-bootstrap.guard';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

@Controller('admin')
export class AdminBootstrapController {
  constructor(private readonly bootstrapService: AdminBootstrapService) {}

  @Post('bootstrap')
  @UseGuards(AdminBootstrapGuard)
  bootstrap(@Body() dto: BootstrapAdminDto) {
    return this.bootstrapService.bootstrap(dto);
  }
}
