import { Resolver, Mutation, Args, Subscription, ID } from '@nestjs/graphql';
import { Inject, forwardRef } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { PackageAggregationService } from './package-aggregation.service';
import { Channel } from './channel.schema';
import { ChannelMessage } from './channel-message.schema';
import { 
  StartPackageAggregationInput, 
  ProcessAggregationMessageInput, 
  UpdateChannelStatusInput,
  FinalizeChannelInput
} from './dto/package-aggregation.input';
import { PackageAggregationEvent } from './channel.types';

@Resolver(() => Channel)
export class PackageAggregationResolver {
  constructor(
    @Inject(forwardRef(() => ChannelService))
    private readonly channelService: ChannelService,
    private readonly packageAggregationService: PackageAggregationService,
  ) {}

  /**
   * Start a new package aggregation session
   */
  @Mutation(() => Channel, {
    name: 'startPackageAggregation',
    description: 'Start a new package aggregation session with real-time functionality',
  })
  async startPackageAggregation(
    @Args('input') input: StartPackageAggregationInput,
  ): Promise<Channel> {
    return this.packageAggregationService.startPackageAggregation(input);
  }

  /**
   * Process a package aggregation message (Validation Phase only)
   */
  @Mutation(() => ChannelMessage, {
    name: 'processAggregationMessage',
    description: 'Process QR codes for package aggregation with validation only (Phase 1)',
  })
  async processAggregationMessage(
    @Args('input') input: ProcessAggregationMessageInput,
  ): Promise<ChannelMessage> {
    return this.packageAggregationService.processAggregationMessage(input);
  }

  /**
   * Finalize channel - Configuration, Relationship Update, and Channel Closure
   */
  @Mutation(() => Channel, {
    name: 'finalizeChannel',
    description: 'Finalize channel by processing configuration, relationships, and closing the channel (Phase 2 & 3)',
  })
  async finalizeChannel(
    @Args('input') input: FinalizeChannelInput,
  ): Promise<Channel> {
    return this.packageAggregationService.finalizeChannel(input.channelId);
  }

  /**
   * Update channel status (pause, close, finalize)
   */
  @Mutation(() => Channel, {
    name: 'updateChannelStatus',
    description: 'Update the status of a package aggregation channel',
  })
  async updateChannelStatus(
    @Args('input') input: UpdateChannelStatusInput,
  ): Promise<Channel> {
    return this.channelService.updateChannelStatus(input);
  }

  /**
   * Subscribe to package aggregation events for a specific channel
   */
  @Subscription(() => PackageAggregationEventType, {
    name: 'packageAggregationEvents',
    description: 'Subscribe to real-time package aggregation events',
    filter: (payload, variables) => {
      // Filter events by channelId if provided
      if (variables.channelId) {
        return payload.packageAggregationEvents.channelId === variables.channelId;
      }
      return true;
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  packageAggregationEvents(
    @Args('channelId', { type: () => ID, nullable: true }) channelId?: string,
  ) {
    return this.channelService.packageAggregationEvents(channelId);
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
             (!variables.channelId || event.channelId === variables.channelId);
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  validationEvents(
    @Args('channelId', { type: () => ID, nullable: true }) channelId?: string,
  ) {
    return this.channelService.packageAggregationEvents(channelId);
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
             (!variables.channelId || event.channelId === variables.channelId);
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  configurationEvents(
    @Args('channelId', { type: () => ID, nullable: true }) channelId?: string,
  ) {
    return this.channelService.packageAggregationEvents(channelId);
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
             (!variables.channelId || event.channelId === variables.channelId);
    },
    resolve: (payload) => payload.packageAggregationEvents,
  })
  aggregationErrorEvents(
    @Args('channelId', { type: () => ID, nullable: true }) channelId?: string,
  ) {
    return this.channelService.packageAggregationEvents(channelId);
  }
}

// GraphQL ObjectType for PackageAggregationEvent
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PackageAggregationEventType {
  @Field()
  channelId: string;

  @Field()
  messageId: string;

  @Field()
  eventType: string;

  @Field({ nullable: true })
  data?: string;

  @Field({ nullable: true })
  error?: string;
}