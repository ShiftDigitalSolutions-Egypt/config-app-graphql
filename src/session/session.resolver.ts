import { Resolver, Query, Mutation, Args, Subscription, ID, ResolveField, Parent } from '@nestjs/graphql';
import { SessionService } from './session.service';
import { Session } from './entities/session.schema';
import { SessionMessage } from './entities/session-message.schema';
import { CreateSessionInput, UpdateSessionInput } from './dto/session.input';


@Resolver(() => Session)
export class SessionResolver {
  constructor(private readonly sessionService: SessionService) {}

  @Query(() => [Session], { name: 'sessions' })
  async getSessions(): Promise<Session[]> {
    return this.sessionService.getSessions();
  }

  @Query(() => Session, { name: 'session' })
  async getSessionById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Session> {
    return this.sessionService.getSessionById(id);
  }

  @Mutation(() => Session)
  async createSession(
    @Args('createSessionInput') createSessionInput: CreateSessionInput,
  ): Promise<Session> {
    return this.sessionService.createSession(createSessionInput);
  }

  @Mutation(() => Session)
  async updateSession(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateSessionInput') updateSessionInput: UpdateSessionInput,
  ): Promise<Session> {
    return this.sessionService.updateSession(id, updateSessionInput);
  }

  @Mutation(() => Session)
  async deleteSession(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Session> {
    return this.sessionService.deleteSession(id);
  }

  // Resolve field for getting messages in a session
  @ResolveField(() => [SessionMessage])
  async messages(@Parent() session: Session): Promise<SessionMessage[]> {
    return this.sessionService.getSessionMessages(session._id);
  }

  // Session Subscriptions
  @Subscription(() => Session, {
    name: 'sessionCreated',
    description: 'Listen for newly created sessions',
    filter: (payload, variables) => {
      return payload.sessionEvents.kind === 'CREATED';
    },
    resolve: (payload) => payload.sessionEvents.session,
  })
  sessionCreated() {
    return this.sessionService.sessionCreated();
  }

  @Subscription(() => Session, {
    name: 'sessionUpdated',
    description: 'Listen for updated sessions',
    filter: (payload, variables) => {
      return payload.sessionEvents.kind === 'UPDATED';
    },
    resolve: (payload) => payload.sessionEvents.session,
  })
  sessionUpdated() {
    return this.sessionService.sessionUpdated();
  }

  @Subscription(() => Session, {
    name: 'sessionDeleted',
    description: 'Listen for deleted sessions',
    filter: (payload, variables) => {
      return payload.sessionEvents.kind === 'DELETED';
    },
    resolve: (payload) => payload.sessionEvents.session,
  })
  sessionDeleted() {
    return this.sessionService.sessionDeleted();
  }
}