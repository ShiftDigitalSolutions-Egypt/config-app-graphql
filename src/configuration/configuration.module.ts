import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigurationService } from './configuration.service';
import { ConfigurationResolver } from './configuration.resolver';
import { QrCode, QrCodeSchema } from '../models/qr-code.entity';
import { Product, ProductSchema } from '../models/product.entity';
import { Supplier, SupplierSchema } from '../models/supplier.entity';
import { Vertical, VerticalSchema } from '../models/vertical.entity';
import { ProductType, ProductTypeSchema } from '../models/product-type.entity';
import { Property, PropertySchema } from '../models/property.entity';
import { PropertyValue, PropertyValueSchema } from '../models/property-value.entity';
import{ Unit, UnitSchema } from '../models/unit.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QrCode.name, schema: QrCodeSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Vertical.name, schema: VerticalSchema },
      { name: ProductType.name, schema: ProductTypeSchema },
      { name: Property.name, schema: PropertySchema },
      { name: PropertyValue.name, schema: PropertyValueSchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
  ],
  providers: [ConfigurationService, ConfigurationResolver],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}