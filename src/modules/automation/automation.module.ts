import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowProcessorService } from './workflow-processor.service';
import { MessagingModule } from '../messaging/messaging.module';
import { WorkflowWorker } from '../../workers/workflow.worker';
import { AutomationExecutionTracker } from './automation-execution-tracker.service';

@Module({
  imports: [MessagingModule],
  controllers: [AutomationController],
  providers: [
    AutomationService,
    WorkflowEngineService,
    WorkflowProcessorService,
    WorkflowWorker,
    AutomationExecutionTracker,
  ],
  exports: [WorkflowEngineService, WorkflowWorker, AutomationExecutionTracker],
})
export class AutomationModule {}
