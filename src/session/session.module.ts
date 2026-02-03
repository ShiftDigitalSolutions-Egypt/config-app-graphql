import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionService } from './session.service';
import { SessionResolver } from './session.resolver';
import { SessionMessageResolver } from './session-message.resolver';
import { PackageAggregationResolver } from './package-aggregation.resolver';
import { PackageAggregationService } from './package-aggregation.service';
import { PubSubService } from './pubsub.service';
import { Session, SessionSchema } from './entities/session.schema';
import { SessionMessage, SessionMessageSchema } from './entities/session-message.schema';
import { Channel, ChannelSchema } from './entities/channel.schema';
import { QrCode, QrCodeSchema } from '../models/qr-code.entity';
import { Product, ProductSchema } from '../models/product.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: SessionMessage.name, schema: SessionMessageSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: QrCode.name, schema: QrCodeSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  providers: [
    PubSubService,
    SessionService, 
    PackageAggregationService,
    SessionResolver, 
    SessionMessageResolver,
    PackageAggregationResolver
  ],
  exports: [SessionService, PackageAggregationService, PubSubService],
})
export class SessionModule {}