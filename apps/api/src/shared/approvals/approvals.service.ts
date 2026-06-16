import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { Repository } from 'typeorm';
import { hasClaim } from '../../common/rbac';
import { ApprovalEntity, ApprovalStepState } from './approval.entity';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalEntity) private readonly approvals: Repository<ApprovalEntity>,
  ) {}

  async open(
    user: UserClaims,
    input: { subjectType: string; subjectId: string; title: string; steps: Array<Pick<ApprovalStepState, 'step' | 'actorClaim'>> },
  ): Promise<ApprovalEntity> {
    if (!input.steps.length) throw new BadRequestException('approval chain needs steps');
    const chain: ApprovalStepState[] = input.steps.map((s) => ({
      ...s,
      status: 'pending',
      by: null,
      at: null,
      note: null,
    }));
    return this.approvals.save(
      this.approvals.create({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        chain,
        currentStep: 0,
        status: 'pending',
        entity: user.entity,
        createdBy: user.email,
      }),
    );
  }

  /** Inbox: chains whose CURRENT step this user may act on. */
  async inbox(user: UserClaims): Promise<ApprovalEntity[]> {
    const pending = await this.approvals.find({ where: { status: 'pending' }, order: { createdAt: 'ASC' } });
    return pending.filter((a) => hasClaim(user, a.chain[a.currentStep].actorClaim));
  }

  async act(
    user: UserClaims,
    id: string,
    action: 'approve' | 'return',
    note?: string,
  ): Promise<ApprovalEntity> {
    const approval = await this.approvals.findOne({ where: { id } });
    if (!approval) throw new NotFoundException('no such approval');
    if (approval.status !== 'pending') throw new BadRequestException(`already ${approval.status}`);
    const step = approval.chain[approval.currentStep];
    if (!hasClaim(user, step.actorClaim)) {
      throw new ForbiddenException(`step ${step.step} requires ${step.actorClaim}`);
    }
    step.by = user.email;
    step.at = new Date().toISOString();
    step.note = note ?? null;
    if (action === 'return') {
      step.status = 'returned';
      approval.status = 'returned';
    } else {
      step.status = 'approved';
      if (approval.currentStep + 1 < approval.chain.length) {
        approval.currentStep += 1;
      } else {
        approval.status = 'approved';
      }
    }
    return this.approvals.save(approval);
  }

  async forSubject(subjectType: string, subjectId: string): Promise<ApprovalEntity | null> {
    return this.approvals.findOne({ where: { subjectType, subjectId }, order: { createdAt: 'DESC' } });
  }

  async countPending(): Promise<number> {
    return this.approvals.count({ where: { status: 'pending' } });
  }
}
