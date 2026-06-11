import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AskAnswer, ReadModelDescriptor, Severity, UserClaims } from '@ubi/types';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, RequireClaims, hasClaim } from '../../common/rbac';
import { InsightEntity } from './insight.entity';
import { ReadModelRegistry } from './read-model.registry';

class AskDto {
  @IsString() @MinLength(2) question: string;
}

class PostInsightDto {
  @IsIn(['critical', 'warning', 'positive', 'info']) severity: Severity;
  @IsString() @MinLength(4) title: string;
  @IsString() @MinLength(4) body: string;
  @IsArray() evidence: string[];
  @IsOptional() @IsArray() actions?: string[];
}

@Controller('ai')
export class AiLayerController {
  constructor(
    private readonly registry: ReadModelRegistry,
    @InjectRepository(InsightEntity) private readonly insights: Repository<InsightEntity>,
  ) {}

  @Get('read-models')
  list(): ReadModelDescriptor[] {
    return this.registry.list();
  }

  @Get('read-models/:key')
  async query(@CurrentUser() user: UserClaims, @Param('key') key: string): Promise<unknown> {
    const model = this.registry.get(key);
    if (!model) throw new NotFoundException(`no read model ${key}`);
    const required = model.descriptor.requiresClaim;
    if (required && !hasClaim(user, required)) {
      throw new ForbiddenException(`read model ${key} requires ${required}`);
    }
    return model.handler(user);
  }

  /**
   * Naive grounded answerer for the scaffold: surfaces which read-models the
   * question touches. The real reasoning runs on an OFF-BOX agent that calls
   * the same registry — this endpoint is its on-box fallback and contract.
   */
  @Post('ask')
  async ask(@CurrentUser() user: UserClaims, @Body() dto: AskDto): Promise<AskAnswer> {
    const q = dto.question.toLowerCase();
    const hits = this.registry
      .list()
      .filter(
        (m) =>
          !m.requiresClaim || hasClaim(user, m.requiresClaim)
            ? q.includes(m.module) || m.title.toLowerCase().split(' ').some((w) => w.length > 4 && q.includes(w))
            : false,
      )
      .slice(0, 4);
    const sources = (hits.length ? hits : this.registry.list().slice(0, 3)).map((m) => m.key);
    const latest = await this.insights.find({
      where: { dismissed: false },
      order: { createdAt: 'DESC' },
      take: 3,
    });
    const digest = latest.map((i) => `• ${i.title}`).join('\n');
    return {
      question: dto.question,
      answer:
        `Scaffold answer (off-box agent not yet wired). Current top signals:\n${digest}\n` +
        `Queryable sources matched: ${sources.join(', ')}.`,
      sources,
      answeredAt: new Date().toISOString(),
    };
  }

  /** Off-box agents post their generated insights back through this gate. */
  @RequireClaims('agent:insights', 'role:admin')
  @Post('insights')
  postInsight(@CurrentUser() user: UserClaims, @Body() dto: PostInsightDto): Promise<InsightEntity> {
    const row = this.insights.create({
      severity: dto.severity,
      title: dto.title,
      body: dto.body,
      evidence: dto.evidence,
      actions: dto.actions ?? [],
      generatedBy: user.email,
      entity: user.entity,
      createdBy: user.email,
    });
    return this.insights.save(row);
  }

  @Get('insights')
  listInsights(): Promise<InsightEntity[]> {
    return this.insights.find({ where: { dismissed: false }, order: { createdAt: 'DESC' }, take: 50 });
  }
}
