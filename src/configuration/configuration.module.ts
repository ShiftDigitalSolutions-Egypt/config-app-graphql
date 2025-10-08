import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigurationService } from './configuration.service';
import { ConfigurationResolver } from './configuration.resolver';
import { QrCode, QrCodeSchema } from '../models/qr-code.entity';
import { Product, ProductSchema } from '../models/product.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QrCode.name, schema: QrCodeSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  providers: [ConfigurationService, ConfigurationResolver],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}