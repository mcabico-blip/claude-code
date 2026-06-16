import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocTrackingController } from './doc-tracking.controller';
import { DocTrackingService } from './doc-tracking.service';
import { DocumentMovementEntity } from './document-movement.entity';
import { DocumentEntity } from './document.entity';

/** Pillar 2 — the backbone. Every department routes paper through here. */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, DocumentMovementEntity])],
  controllers: [DocTrackingController],
  providers: [DocTrackingService],
  exports: [DocTrackingService],
})
export class DocTrackingModule {}
