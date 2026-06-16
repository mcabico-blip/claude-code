import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { MaterialsScheduleLine, UserClaims } from '@ubi/types';
import { IsArray, IsDateString, IsString } from 'class-validator';
import { CurrentUser } from '../../common/rbac';
import { MaterialsScheduleEntity, PayItemEntity, ProjectEntity } from './entities';
import { EngineeringService } from './engineering.service';

class CreateScheduleDto {
  @IsString() projectId: string;
  @IsDateString() weekOf: string;
  @IsArray() lines: MaterialsScheduleLine[];
}

@Controller('engineering')
export class EngineeringController {
  constructor(private readonly svc: EngineeringService) {}

  @Get('projects')
  projects(): Promise<ProjectEntity[]> {
    return this.svc.listProjects();
  }

  @Get('pay-items')
  payItems(): Promise<PayItemEntity[]> {
    return this.svc.listPayItems();
  }

  @Get('materials-schedules')
  schedules(): Promise<MaterialsScheduleEntity[]> {
    return this.svc.listSchedules();
  }

  @Get('materials-schedules/prefill/:projectId')
  prefill(@Param('projectId') projectId: string): Promise<MaterialsScheduleLine[]> {
    return this.svc.aiPrefill(projectId);
  }

  @Post('materials-schedules')
  create(
    @CurrentUser() user: UserClaims,
    @Body() dto: CreateScheduleDto,
  ): Promise<MaterialsScheduleEntity> {
    return this.svc.createSchedule(user, dto);
  }

  @Post('materials-schedules/:id/submit')
  submit(@CurrentUser() user: UserClaims, @Param('id') id: string): Promise<MaterialsScheduleEntity> {
    return this.svc.submitSchedule(user, id);
  }
}
