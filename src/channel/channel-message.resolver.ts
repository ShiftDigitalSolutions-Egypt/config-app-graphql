import { Resolver, Query, Mutation, Args, Subscription, ID, ResolveField, Parent } from '@nestjs/graphql';
import { ChannelService } from './channel.service';
import { Channel } from './channel.schema';
import { ChannelMessage } from './channel-message.schema';
import { CreateChannelMessageInput, UpdateChannelMessageInput } from './dto/channel-message.input';

@Resolver(() => ChannelMessage)
export class ChannelMessageResolver {
  constructor(private readonly channelService: ChannelService) {}

  @Query(() => [ChannelMessage], { name: 'messages' })
  async getAllMessages(): Promise<ChannelMessage[]> {
    return this.channelService.getAllMessages();
  }

  @Query(() => [ChannelMessage], { name: 'channelMessages' })
  async getChannelMessages(
    @Args('channelId', { type: () => ID }) channelId: string,
  ): Promise<ChannelMessage[]> {
    return this.channelService.getChannelMessages(channelId);
  }

  @Query(() => ChannelMessage, { name: 'message' })
  async getMessageById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ChannelMessage> {
    return this.channelService.getMessageById(id);
  }

  @Mutation(() => ChannelMessage)
  async createChannelMessage(
    @Args('createChannelMessageInput') createChannelMessageInput: CreateChannelMessageInput,
  ): Promise<ChannelMessage> {
    return this.channelService.createChannelMessage(createChannelMessageInput);
  }

  @Mutation(() => ChannelMessage)
  async updateChannelMessage(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateChannelMessageInput') updateChannelMessageInput: UpdateChannelMessageInput,
  ): Promise<ChannelMessage> {
    return this.channelService.updateChannelMessage(id, updateChannelMessageInput);
  }

  @Mutation(() => ChannelMessage)
  async deleteChannelMessage(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ChannelMessage> {
    return this.channelService.deleteChannelMessage(id);
  }

  // Resolve field for getting the channel information
  @ResolveField(() => Channel)
  async channel(@Parent() message: ChannelMessage): Promise<Channel> {
    if (message.channel) {
      return message.channel;
    }
    return this.channelService.getChannelById(message.channelId);
  }

  // Message Subscriptions
  @Subscription(() => ChannelMessage, {
    name: 'messageCreated',
    description: 'Listen for newly created messages',
    filter: (payload, variables) => {
      return payload.messageEvents.kind === 'CREATED';
    },
    resolve: (payload) => payload.messageEvents.message,
  })
  messageCreated() {
    return this.channelService.messageCreated();
  }

  @Subscription(() => ChannelMessage, {
    name: 'messageUpdated',
    description: 'Listen for updated messages',
    filter: (payload, variables) => {
      return payload.messageEvents.kind === 'UPDATED';
    },
    resolve: (payload) => payload.messageEvents.message,
  })
  messageUpdated() {
    return this.channelService.messageUpdated();
  }

  @Subscription(() => ChannelMessage, {
    name: 'messageDeleted',
    description: 'Listen for deleted messages',
    filter: (payload, variables) => {
      return payload.messageEvents.kind === 'DELETED';
    },
    resolve: (payload) => payload.messageEvents.message,
  })
  messageDeleted() {
    return this.channelService.messageDeleted();
  }
}