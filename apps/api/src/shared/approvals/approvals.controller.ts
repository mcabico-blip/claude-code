import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { UserClaims } from '@ubi/types';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/rbac';
import { ApprovalEntity } from './approval.entity';
import { ApprovalsService } from './approvals.service';

class ActDto {
  @IsIn(['approve', 'return']) action: 'approve' | 'return';
  @IsOptional() @IsString() note?: string;
}

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly svc: ApprovalsService) {}

  @Get()
  inbox(@CurrentUser() user: UserClaims): Promise<ApprovalEntity[]> {
    return this.svc.inbox(user);
  }

  @Post(':id/act')
  act(
    @CurrentUser() user: UserClaims,
    @Param('id') id: string,
    @Body() dto: ActDto,
  ): Promise<ApprovalEntity> {
    return this.svc.act(user, id, dto.action, dto.note);
  }
}
