import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './entities/session.schema';
import { SessionMessage, SessionMessageDocument } from './entities/session-message.schema';
import { CreateSessionInput, UpdateSessionInput } from './dto/session.input';
import { CreateSessionMessageInput, UpdateSessionMessageInput } from './dto/session-message.input';
import { startAggregationInput, UpdateSessionStatusInput } from './dto/package-aggregation.input';
import { PubSubService } from './pubsub.service';
import { SessionEventKind, MessageEventKind, SessionStatus, SessionMode } from '../common/enums';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(SessionMessage.name) private sessionMessageModel: Model<SessionMessageDocument>,
    private readonly pubSubService: PubSubService,
  ) {}

  // Session CRUD operations
  async createSession(createSessionInput: CreateSessionInput): Promise<Session> {
    const createdSession = new this.sessionModel(createSessionInput);
    const savedSession = await createdSession.save();
    
    // Publish session event using new system
    await this.pubSubService.publishSessionEvent({
      id: savedSession._id.toString(),
      _id: savedSession._id.toString(),
      name: savedSession.name,
      description: savedSession.description,
      status: savedSession.status,
      sessionMode: savedSession.sessionMode,
      userId: savedSession.userId,
      processedQrCodes: savedSession.processedQrCodes || [],
      createdAt: savedSession.createdAt,
      updatedAt: savedSession.updatedAt,
    }, SessionEventKind.CREATED);
    
    return savedSession;
  }

  async getSessions(): Promise<Session[]> {
    return this.sessionModel.find().exec();
  }

  async getSessionById(id: string): Promise<Session> {
    return this.sessionModel.findById(id).exec();
  }

  async updateSession(id: string, updateSessionInput: UpdateSessionInput): Promise<Session> {
    const updatedSession = await this.sessionModel.findByIdAndUpdate(
      id,
      updateSessionInput,
      { new: true },
    ).exec();
    
    // Publish session event using new system
    await this.pubSubService.publishSessionEvent({
      id: updatedSession._id.toString(),
      _id: updatedSession._id.toString(),
      name: updatedSession.name,
      description: updatedSession.description,
      status: updatedSession.status,
      sessionMode: updatedSession.sessionMode,
      userId: updatedSession.userId,
      processedQrCodes: updatedSession.processedQrCodes || [],
      createdAt: updatedSession.createdAt,
      updatedAt: updatedSession.updatedAt,
    }, SessionEventKind.UPDATED);
    
    return updatedSession;
  }

  async deleteSession(id: string): Promise<Session> {
    // First delete all messages in the session
    await this.sessionMessageModel.deleteMany({ sessionId: id }).exec();
    
    const deletedSession = await this.sessionModel.findByIdAndDelete(id).exec();
    
    // Close all opened subscriptions related to this session
    await this.pubSubService.closeSessionSubscriptions(id);
    
    // Publish session event using new system
    await this.pubSubService.publishSessionEvent({
      id: deletedSession._id.toString(),
      _id: deletedSession._id.toString(),
      name: deletedSession.name,
      description: deletedSession.description,
      status: deletedSession.status,
      sessionMode: deletedSession.sessionMode,
      userId: deletedSession.userId,
      processedQrCodes: deletedSession.processedQrCodes || [],
      createdAt: deletedSession.createdAt,
      updatedAt: deletedSession.updatedAt,
    }, SessionEventKind.DELETED);
    
    return deletedSession;
  }

  // SessionMessage CRUD operations
  async createSessionMessage(createSessionMessageInput: CreateSessionMessageInput): Promise<SessionMessage> {
    const createdMessage = new this.sessionMessageModel(createSessionMessageInput);
    const savedMessage = await createdMessage.save();
    
    // Populate the session information
    const populatedMessage = await this.sessionMessageModel
      .findById(savedMessage._id)
      .populate('sessionId')
      .exec();
    
    // Publish message event using new system
    await this.pubSubService.publishMessageEvent({
      id: populatedMessage._id.toString(),
      _id: populatedMessage._id.toString(),
      content: populatedMessage.content,
      author: populatedMessage.author,
      sessionId: populatedMessage.sessionId,
      status: populatedMessage.status,
      aggregationData: populatedMessage.aggregationData,
      errorMessage: populatedMessage.errorMessage,
      createdAt: populatedMessage.createdAt,
      updatedAt: populatedMessage.updatedAt,
    }, MessageEventKind.CREATED);
    
    return populatedMessage;
  }

  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    return this.sessionMessageModel
      .find({ sessionId })
      .populate('sessionId')
      .sort({ createdAt: 1 })
      .exec();
  }

  async getAllMessages(): Promise<SessionMessage[]> {
    return this.sessionMessageModel
      .find()
      .populate('sessionId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getMessageById(id: string): Promise<SessionMessage> {
    return this.sessionMessageModel
      .findById(id)
      .populate('sessionId')
      .exec();
  }

  async updateSessionMessage(id: string, updateSessionMessageInput: UpdateSessionMessageInput): Promise<SessionMessage> {
    const updatedMessage = await this.sessionMessageModel
      .findByIdAndUpdate(id, updateSessionMessageInput, { new: true })
      .populate('sessionId')
      .exec();
    
    // Publish message event using new system
    await this.pubSubService.publishMessageEvent({
      id: updatedMessage._id.toString(),
      _id: updatedMessage._id.toString(),
      content: updatedMessage.content,
      author: updatedMessage.author,
      sessionId: updatedMessage.sessionId,
      status: updatedMessage.status,
      aggregationData: updatedMessage.aggregationData,
      errorMessage: updatedMessage.errorMessage,
      createdAt: updatedMessage.createdAt,
      updatedAt: updatedMessage.updatedAt,
    }, MessageEventKind.UPDATED);
    
    return updatedMessage;
  }

  async deleteSessionMessage(id: string): Promise<SessionMessage> {
    const deletedMessage = await this.sessionMessageModel
      .findByIdAndDelete(id)
      .populate('sessionId')
      .exec();
    
    // Publish message event using new system
    await this.pubSubService.publishMessageEvent({
      id: deletedMessage._id.toString(),
      _id: deletedMessage._id.toString(),
      content: deletedMessage.content,
      author: deletedMessage.author,
      sessionId: deletedMessage.sessionId,
      status: deletedMessage.status,
      aggregationData: deletedMessage.aggregationData,
      errorMessage: deletedMessage.errorMessage,
      createdAt: deletedMessage.createdAt,
      updatedAt: deletedMessage.updatedAt,
    }, MessageEventKind.DELETED);
    
    return deletedMessage;
  }

  // Subscription methods for Sessions
  sessionCreated() {
    return this.pubSubService.getSessionAsyncIterator();
  }

  sessionUpdated() {
    return this.pubSubService.getSessionAsyncIterator();
  }

  sessionDeleted() {
    return this.pubSubService.getSessionAsyncIterator();
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

  async updateSessionStatus(input: UpdateSessionStatusInput): Promise<Session> {
    const updatedSession = await this.sessionModel.findByIdAndUpdate(
      input.sessionId,
      { status: input.status },
      { new: true }
    ).exec();

    if (!updatedSession) {
      throw new Error(`Session with ID '${input.sessionId}' not found`);
    }

    // Publish session event
    await this.pubSubService.publishSessionEvent({
      id: updatedSession._id.toString(),
      _id: updatedSession._id.toString(),
      name: updatedSession.name,
      description: updatedSession.description,
      status: updatedSession.status,
      sessionMode: updatedSession.sessionMode,
      userId: updatedSession.userId,
      processedQrCodes: updatedSession.processedQrCodes || [],
      createdAt: updatedSession.createdAt,
      updatedAt: updatedSession.updatedAt,
    }, SessionEventKind.UPDATED);

    return updatedSession;
  }

  // Subscription methods for Package Aggregation
  async packageAggregationEvents(sessionId: string) {
    // validate that sessionId is alredy exist
    const sessionExists = await this.sessionModel.findById(sessionId).exec();
    if (!sessionExists) {
      throw new Error(`Session with ID '${sessionId}' does not exist`);
    }

    // validate that session is not finalized
    if (sessionExists.status === SessionStatus.FINALIZED) {
      throw new Error(`Session with ID '${sessionId}' is finalized and cannot accept new messages`);
    }

    return this.pubSubService.getPackageAggregationAsyncIterator(sessionId);
  }

}