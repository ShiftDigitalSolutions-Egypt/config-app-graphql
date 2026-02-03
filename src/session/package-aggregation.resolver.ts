import { Resolver, Mutation, Args, Subscription, ID } from '@nestjs/graphql';
import { Inject, forwardRef } from '@nestjs/common';
import { SessionService } from './session.service';
import { PackageAggregationService } from './package-aggregation.service';
import { Session } from './entities/session.schema';
import { SessionMessage } from './entities/session-message.schema';
import { 
  startAggregationInput, 
  ProcessAggregationMessageInput, 
  UpdateSessionStatusInput,
  FinalizeSessionInput
} from './dto/package-aggregation.input';
import { PackageAggregationEvent } from './session.types';
import { MessageStatus } from '../common/enums';
// GraphQL ObjectType for PackageAggregationEvent
import { ObjectType, Field } from '@nestjs/graphql';


@Resolver(() => Session)
export class PackageAggregationResolver {
  constructor(
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly packageAggregationService: PackageAggregationService,
  ) {}

  /**
   * Start a new package aggregation session
   */
  @Mutation(() => Session, {
    name: 'startAggregation',
    description: 'Start a new package aggregation session with real-time functionality',
  })
  async startAggregation(
    @Args('input') input: startAggregationInput,
  ): Promise<Session> {
    return this.packageAggregationService.startAggregation(input);
  }

  /**
   * Process a package aggregation message (Validation Phase only)
   */
  @Mutation(() => SessionMessage, {
    name: 'processAggregationMessage',
    description: 'Process QR codes for package aggregation with validation only (Phase 1)',
  })
  async processAggregationMessage(
    @Args('input') input: ProcessAggregationMessageInput,
  ): Promise<SessionMessage> {
    return this.packageAggregationService.processAggregationMessage(input);
  }

  /**
   * Finalize session - Configuration, Relationship Update, and Session Closure
   */
  @Mutation(() => Session, {
    name: 'finalizeSession',
    description: 'Finalize session by processing configuration, relationships, and closing the session (Phase 2 & 3)',
  })
  async finalizeSession(
    @Args('input') input: FinalizeSessionInput,
  ): Promise<Session> {
    return this.packageAggregationService.finalizeSession(input.sessionId);
  }

  /**
   * Update session status (pause, close, finalize)
   */
  @Mutation(() => Session, {
    name: 'updateSessionStatus',
    description: 'Update the status of a package aggregation session',
  })
  async updateSessionStatus(
    @Args('input') input: UpdateSessionStatusInput,
  ): Promise<Session> {
    return this.sessionService.updateSessionStatus(input);
  }

  /**
   * Subscribe to package aggregation events for a specific session
   */
  @Subscription(() => PackageAggregationEventType, {
    name: 'packageAggregationEvents',
    description: 'Subscribe to real-time package aggregation events',
    filter: (payload, variables) => {
      // Filter events by sessionId if provided
      if (variables.sessionId) {
        return payload.packageAggregationEvents.sessionId === variables.sessionId;
      }
      return true;
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  packageAggregationEvents(
    @Args('sessionId', { type: () => ID, nullable: true }) sessionId?: string,
  ) {
    return this.sessionService.packageAggregationEvents(sessionId);
  }

  /**
   * Subscribe to real-time validation events
   */
  @Subscription(() => PackageAggregationEventType, {
    name: 'validationEvents',
    description: 'Subscribe to real-time validation events during package aggregation',
    filter: (payload, variables) => {
      const event = payload.packageAggregationEvents as PackageAggregationEvent;
      return event.eventType === 'VALIDATION_COMPLETED' && 
             (!variables.sessionId || event.sessionId === variables.sessionId);
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  validationEvents(
    @Args('sessionId', { type: () => ID, nullable: true }) sessionId?: string,
  ) {
    return this.sessionService.packageAggregationEvents(sessionId);
  }

  /**
   * Subscribe to real-time configuration events
   */
  @Subscription(() => PackageAggregationEventType, {
    name: 'configurationEvents',
    description: 'Subscribe to real-time configuration events during package aggregation',
    filter: (payload, variables) => {
      const event = payload.packageAggregationEvents as PackageAggregationEvent;
      return event.eventType === 'CONFIGURATION_COMPLETED' && 
             (!variables.sessionId || event.sessionId === variables.sessionId);
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  configurationEvents(
    @Args('sessionId', { type: () => ID, nullable: true }) sessionId?: string,
  ) {
    return this.sessionService.packageAggregationEvents(sessionId);
  }

  /**
   * Subscribe to error events
   */
  @Subscription(() => PackageAggregationEventType, {
    name: 'aggregationErrorEvents',
    description: 'Subscribe to real-time error events during package aggregation',
    filter: (payload, variables) => {
      const event = payload.packageAggregationEvents as PackageAggregationEvent;
      return event.eventType === 'ERROR' && 
             (!variables.sessionId || event.sessionId === variables.sessionId);
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  aggregationErrorEvents(
    @Args('sessionId', { type: () => ID, nullable: true }) sessionId?: string,
  ) {
    return this.sessionService.packageAggregationEvents(sessionId);
  }
}


@ObjectType()
export class PackageAggregationEventType {
  @Field()
  sessionId: string;

  @Field()
  messageId: string;

  @Field()
  eventType: string;

  @Field({ nullable: true })
  data?: string;

  @Field({ nullable: true })
  error?: string;

  @Field(() => MessageStatus, { nullable: true })
  status?: MessageStatus;
}