import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Channel, ChannelDocument } from './channel.schema';
import { ChannelMessage, ChannelMessageDocument } from './channel-message.schema';
import { CreateChannelInput, UpdateChannelInput } from './dto/channel.input';
import { CreateChannelMessageInput, UpdateChannelMessageInput } from './dto/channel-message.input';
import { PubSubService } from './pubsub.service';
import { ChannelEventKind, MessageEventKind } from '../common/enums';

@Injectable()
export class ChannelService {
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(ChannelMessage.name) private channelMessageModel: Model<ChannelMessageDocument>,
    private readonly pubSubService: PubSubService,
  ) {}

  // Channel CRUD operations
  async createChannel(createChannelInput: CreateChannelInput): Promise<Channel> {
    const createdChannel = new this.channelModel(createChannelInput);
    const savedChannel = await createdChannel.save();
    
    // Publish channel event using new system
    await this.pubSubService.publishChannelEvent({
      id: savedChannel._id.toString(),
      _id: savedChannel._id.toString(),
      name: savedChannel.name,
      description: savedChannel.description,
      createdAt: savedChannel.createdAt,
      updatedAt: savedChannel.updatedAt,
    }, ChannelEventKind.CREATED);
    
    return savedChannel;
  }

  async getChannels(): Promise<Channel[]> {
    return this.channelModel.find().exec();
  }

  async getChannelById(id: string): Promise<Channel> {
    return this.channelModel.findById(id).exec();
  }

  async updateChannel(id: string, updateChannelInput: UpdateChannelInput): Promise<Channel> {
    const updatedChannel = await this.channelModel.findByIdAndUpdate(
      id,
      updateChannelInput,
      { new: true },
    ).exec();
    
    // Publish channel event using new system
    await this.pubSubService.publishChannelEvent({
      id: updatedChannel._id.toString(),
      _id: updatedChannel._id.toString(),
      name: updatedChannel.name,
      description: updatedChannel.description,
      createdAt: updatedChannel.createdAt,
      updatedAt: updatedChannel.updatedAt,
    }, ChannelEventKind.UPDATED);
    
    return updatedChannel;
  }

  async deleteChannel(id: string): Promise<Channel> {
    // First delete all messages in the channel
    await this.channelMessageModel.deleteMany({ channelId: id }).exec();
    
    const deletedChannel = await this.channelModel.findByIdAndDelete(id).exec();
    
    // Publish channel event using new system
    await this.pubSubService.publishChannelEvent({
      id: deletedChannel._id.toString(),
      _id: deletedChannel._id.toString(),
      name: deletedChannel.name,
      description: deletedChannel.description,
      createdAt: deletedChannel.createdAt,
      updatedAt: deletedChannel.updatedAt,
    }, ChannelEventKind.DELETED);
    
    return deletedChannel;
  }

  // ChannelMessage CRUD operations
  async createChannelMessage(createChannelMessageInput: CreateChannelMessageInput): Promise<ChannelMessage> {
    const createdMessage = new this.channelMessageModel(createChannelMessageInput);
    const savedMessage = await createdMessage.save();
    
    // Populate the channel information
    const populatedMessage = await this.channelMessageModel
      .findById(savedMessage._id)
      .populate('channelId')
      .exec();
    
    // Publish message event using new system
    await this.pubSubService.publishMessageEvent({
      id: populatedMessage._id.toString(),
      _id: populatedMessage._id.toString(),
      content: populatedMessage.content,
      author: populatedMessage.author,
      channelId: populatedMessage.channelId,
      createdAt: populatedMessage.createdAt,
      updatedAt: populatedMessage.updatedAt,
    }, MessageEventKind.CREATED);
    
    return populatedMessage;
  }

  async getChannelMessages(channelId: string): Promise<ChannelMessage[]> {
    return this.channelMessageModel
      .find({ channelId })
      .populate('channelId')
      .sort({ createdAt: 1 })
      .exec();
  }

  async getAllMessages(): Promise<ChannelMessage[]> {
    return this.channelMessageModel
      .find()
      .populate('channelId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getMessageById(id: string): Promise<ChannelMessage> {
    return this.channelMessageModel
      .findById(id)
      .populate('channelId')
      .exec();
  }

  async updateChannelMessage(id: string, updateChannelMessageInput: UpdateChannelMessageInput): Promise<ChannelMessage> {
    const updatedMessage = await this.channelMessageModel
      .findByIdAndUpdate(id, updateChannelMessageInput, { new: true })
      .populate('channelId')
      .exec();
    
    // Publish message event using new system
    await this.pubSubService.publishMessageEvent({
      id: updatedMessage._id.toString(),
      _id: updatedMessage._id.toString(),
      content: updatedMessage.content,
      author: updatedMessage.author,
      channelId: updatedMessage.channelId,
      createdAt: updatedMessage.createdAt,
      updatedAt: updatedMessage.updatedAt,
    }, MessageEventKind.UPDATED);
    
    return updatedMessage;
  }

  async deleteChannelMessage(id: string): Promise<ChannelMessage> {
    const deletedMessage = await this.channelMessageModel
      .findByIdAndDelete(id)
      .populate('channelId')
      .exec();
    
    // Publish message event using new system
    await this.pubSubService.publishMessageEvent({
      id: deletedMessage._id.toString(),
      _id: deletedMessage._id.toString(),
      content: deletedMessage.content,
      author: deletedMessage.author,
      channelId: deletedMessage.channelId,
      createdAt: deletedMessage.createdAt,
      updatedAt: deletedMessage.updatedAt,
    }, MessageEventKind.DELETED);
    
    return deletedMessage;
  }

  // Subscription methods for Channels
  channelCreated() {
    return this.pubSubService.getChannelAsyncIterator();
  }

  channelUpdated() {
    return this.pubSubService.getChannelAsyncIterator();
  }

  channelDeleted() {
    return this.pubSubService.getChannelAsyncIterator();
  }

  // Subscription methods for Messages
  messageCreated() {
    return this.pubSubService.getMessageAsyncIterator();
  }

  messageUpdated() {
    return this.pubSubService.getMessageAsyncIterator();
  }

  messageDeleted() {
    return this.pubSubService.getMessageAsyncIterator();
  }

}