import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelService } from './channel.service';
import { ChannelResolver } from './channel.resolver';
import { ChannelMessageResolver } from './channel-message.resolver';
import { PackageAggregationResolver } from './package-aggregation.resolver';
import { PackageAggregationService } from './package-aggregation.service';
import { PubSubService } from './pubsub.service';
import { Channel, ChannelSchema } from './channel.schema';
import { ChannelMessage, ChannelMessageSchema } from './channel-message.schema';
import { QrCode, QrCodeSchema } from '../models/qr-code.entity';
import { Product, ProductSchema } from '../models/product.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Channel.name, schema: ChannelSchema },
      { name: ChannelMessage.name, schema: ChannelMessageSchema },
      { name: QrCode.name, schema: QrCodeSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  providers: [
    PubSubService,
    ChannelService, 
    PackageAggregationService,
    ChannelResolver, 
    ChannelMessageResolver,
    PackageAggregationResolver
  ],
  exports: [ChannelService, PackageAggregationService, PubSubService],
})
export class ChannelModule {}