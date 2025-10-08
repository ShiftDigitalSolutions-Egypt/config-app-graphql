import { Resolver, Query, Mutation, Args, Subscription, ID, ResolveField, Parent } from '@nestjs/graphql';
import { ChannelService } from './channel.service';
import { Channel } from './channel.schema';
import { ChannelMessage } from './channel-message.schema';
import { CreateChannelInput, UpdateChannelInput } from './dto/channel.input';

@Resolver(() => Channel)
export class ChannelResolver {
  constructor(private readonly channelService: ChannelService) {}

  @Query(() => [Channel], { name: 'channels' })
  async getChannels(): Promise<Channel[]> {
    return this.channelService.getChannels();
  }

  @Query(() => Channel, { name: 'channel' })
  async getChannelById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Channel> {
    return this.channelService.getChannelById(id);
  }

  @Mutation(() => Channel)
  async createChannel(
    @Args('createChannelInput') createChannelInput: CreateChannelInput,
  ): Promise<Channel> {
    return this.channelService.createChannel(createChannelInput);
  }

  @Mutation(() => Channel)
  async updateChannel(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateChannelInput') updateChannelInput: UpdateChannelInput,
  ): Promise<Channel> {
    return this.channelService.updateChannel(id, updateChannelInput);
  }

  @Mutation(() => Channel)
  async deleteChannel(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Channel> {
    return this.channelService.deleteChannel(id);
  }

  // Resolve field for getting messages in a channel
  @ResolveField(() => [ChannelMessage])
  async messages(@Parent() channel: Channel): Promise<ChannelMessage[]> {
    return this.channelService.getChannelMessages(channel._id);
  }

  // Channel Subscriptions
  @Subscription(() => Channel, {
    name: 'channelCreated',
    description: 'Listen for newly created channels',
    filter: (payload, variables) => {
      return payload.channelEvents.kind === 'CREATED';
    },
    resolve: (payload) => payload.channelEvents.channel,
  })
  channelCreated() {
    return this.channelService.channelCreated();
  }

  @Subscription(() => Channel, {
    name: 'channelUpdated',
    description: 'Listen for updated channels',
    filter: (payload, variables) => {
      return payload.channelEvents.kind === 'UPDATED';
    },
    resolve: (payload) => payload.channelEvents.channel,
  })
  channelUpdated() {
    return this.channelService.channelUpdated();
  }

  @Subscription(() => Channel, {
    name: 'channelDeleted',
    description: 'Listen for deleted channels',
    filter: (payload, variables) => {
      return payload.channelEvents.kind === 'DELETED';
    },
    resolve: (payload) => payload.channelEvents.channel,
  })
  channelDeleted() {
    return this.channelService.channelDeleted();
  }
}