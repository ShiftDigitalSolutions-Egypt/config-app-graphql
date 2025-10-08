import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelService } from './channel.service';
import { ChannelResolver } from './channel.resolver';
import { ChannelMessageResolver } from './channel-message.resolver';
import { PubSubService } from './pubsub.service';
import { Channel, ChannelSchema } from './channel.schema';
import { ChannelMessage, ChannelMessageSchema } from './channel-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Channel.name, schema: ChannelSchema },
      { name: ChannelMessage.name, schema: ChannelMessageSchema },
    ]),
  ],
  providers: [
    PubSubService,
    ChannelService, 
    ChannelResolver, 
    ChannelMessageResolver
  ],
  exports: [ChannelService, PubSubService],
})
export class ChannelModule {}