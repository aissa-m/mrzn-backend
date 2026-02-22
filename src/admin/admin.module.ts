import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { AttributesModule } from '../attributes/attributes.module';
import { AdminHealthController } from './health/admin-health.controller';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminCategoriesController } from './categories/admin-categories.controller';
import { AdminAttributesController } from './attributes/admin-attributes.controller';
import { AdminBootstrapController } from './bootstrap/admin-bootstrap.controller';
import { AdminBootstrapService } from './bootstrap/admin-bootstrap.service';
import { AdminBootstrapGuard } from './bootstrap/admin-bootstrap.guard';

@Module({
  imports: [AuthModule, CategoriesModule, AttributesModule],
  controllers: [
    AdminHealthController,
    AdminUsersController,
    AdminCategoriesController,
    AdminAttributesController,
    AdminBootstrapController,
  ],
  providers: [AdminBootstrapService, AdminBootstrapGuard],
})
export class AdminModule {}
