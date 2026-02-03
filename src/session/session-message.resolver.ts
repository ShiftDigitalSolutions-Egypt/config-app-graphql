import { Resolver, Query, Mutation, Args, Subscription, ID, ResolveField, Parent } from '@nestjs/graphql';
import { Inject, forwardRef } from '@nestjs/common';
import { SessionService } from './session.service';
import { PackageAggregationService } from './package-aggregation.service';
import { Session } from './entities/session.schema';
import { SessionMessage } from './entities/session-message.schema';
import { CreateSessionMessageInput, UpdateSessionMessageInput } from './dto/session-message.input';
import { ProcessAggregationMessageInput } from './dto/package-aggregation.input';

@Resolver(() => SessionMessage)
export class SessionMessageResolver {
  constructor(
    private readonly sessionService: SessionService,
    private readonly packageAggregationService: PackageAggregationService,
  ) {}

  @Query(() => [SessionMessage], { name: 'messages' })
  async getAllMessages(): Promise<SessionMessage[]> {
    return this.sessionService.getAllMessages();
  }

  @Query(() => [SessionMessage], { name: 'sessionMessages' })
  async getSessionMessages(
    @Args('sessionId', { type: () => ID }) sessionId: string,
  ): Promise<SessionMessage[]> {
    return this.sessionService.getSessionMessages(sessionId);
  }

  @Query(() => SessionMessage, { name: 'message' })
  async getMessageById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SessionMessage> {
    return this.sessionService.getMessageById(id);
  }

  @Mutation(() => SessionMessage)
  async createSessionMessage(
    @Args('createSessionMessageInput') createSessionMessageInput: CreateSessionMessageInput,
  ): Promise<SessionMessage> {
    return this.sessionService.createSessionMessage(createSessionMessageInput);
  }

  @Mutation(() => SessionMessage)
  async updateSessionMessage(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateSessionMessageInput') updateSessionMessageInput: UpdateSessionMessageInput,
  ): Promise<SessionMessage> {
    return this.sessionService.updateSessionMessage(id, updateSessionMessageInput);
  }

  @Mutation(() => SessionMessage)
  async deleteSessionMessage(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SessionMessage> {
    return this.sessionService.deleteSessionMessage(id);
  }

  /**
   * Process aggregation message (package aggregation specific)
   */
  @Mutation(() => SessionMessage, {
    name: 'processAggregationMessage',
    description: 'Process a QR code aggregation message with real-time validation and configuration',
  })
  async processAggregationMessage(
    @Args('input') input: ProcessAggregationMessageInput,
  ): Promise<SessionMessage> {
    return this.packageAggregationService.processAggregationMessage(input);
  }

  // Resolve field for getting the session information
  @ResolveField(() => Session)
  async session(@Parent() message: SessionMessage): Promise<Session> {
    if (message.session) {
      return message.session;
    }
    return this.sessionService.getSessionById(message.sessionId);
  }

  // Message Subscriptions
  @Subscription(() => SessionMessage, {
    name: 'messageCreated',
    description: 'Listen for newly created messages',
    filter: (payload, variables) => {
      return payload.messageEvents.kind === 'CREATED';
    },
    resolve: (payload) => payload.messageEvents.message,
  })
  messageCreated() {
    return this.sessionService.messageCreated();
  }

  @Subscription(() => SessionMessage, {
    name: 'messageUpdated',
    description: 'Listen for updated messages',
    filter: (payload, variables) => {
      return payload.messageEvents.kind === 'UPDATED';
    },
    resolve: (payload) => payload.messageEvents.message,
  })
  messageUpdated() {
    return this.sessionService.messageUpdated();
  }

  @Subscription(() => SessionMessage, {
    name: 'messageDeleted',
    description: 'Listen for deleted messages',
    filter: (payload, variables) => {
      return payload.messageEvents.kind === 'DELETED';
    },
    resolve: (payload) => payload.messageEvents.message,
  })
  messageDeleted() {
    return this.sessionService.messageDeleted();
  }
}