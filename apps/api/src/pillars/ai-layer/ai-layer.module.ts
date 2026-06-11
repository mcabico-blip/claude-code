import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiLayerController } from './ai-layer.controller';
import { InsightEntity } from './insight.entity';
import { ReadModelRegistry } from './read-model.registry';

/** Pillar 3 — global so every module can register its read surface. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([InsightEntity])],
  controllers: [AiLayerController],
  providers: [ReadModelRegistry],
  exports: [ReadModelRegistry, TypeOrmModule],
})
export class AiLayerModule {}
