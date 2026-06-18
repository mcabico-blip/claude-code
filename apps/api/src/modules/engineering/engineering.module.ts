import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsScheduleEntity, PayItemEntity, ProjectEntity } from './entities';
import { EngineeringController } from './engineering.controller';
import { EngineeringService } from './engineering.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, PayItemEntity, MaterialsScheduleEntity])],
  controllers: [EngineeringController],
  providers: [EngineeringService],
  exports: [EngineeringService, TypeOrmModule],
})
export class EngineeringModule {}
