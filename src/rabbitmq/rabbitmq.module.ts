import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { QrCode, QrCodeSchema } from "../models/qr-code.entity";
import { Product, ProductSchema } from "../models/product.entity";
import { Supplier, SupplierSchema } from "../models/supplier.entity";
import { Vertical, VerticalSchema } from "../models/vertical.entity";
import { ProductType, ProductTypeSchema } from "../models/product-type.entity";
import { Property, PropertySchema } from "../models/property.entity";
import {
  PropertyValue,
  PropertyValueSchema,
} from "../models/property-value.entity";
import { Unit, UnitSchema } from "../models/unit.entity";
import { Session, SessionSchema } from "../session/entities/session.schema";
import {
  SessionMessage,
  SessionMessageSchema,
} from "../session/entities/session-message.schema";
import { ConfigurationModule } from "../configuration/configuration.module";
import { RabbitMQConnectionService } from "./services/rabbitmq-connection.service";
import { PackageUpdatePublisher } from "./publishers/package-update.publisher";
import { PackageUpdateConsumer } from "./consumers/package-update.consumer";
import { QrConfigurationPublisher } from "./publishers/qr-configuration.publisher";
import { QrConfigurationConsumer } from "./consumers/qr-configuration.consumer";
import rabbitmqConfig from "./config/rabbitmq.config";

/**
 * RabbitMQ Module for handling asynchronous QR configuration processing
 *
 * This module provides:
 * - Real RabbitMQ connection management with automatic reconnection
 * - Async QR configuration publishing (fire-and-forget pattern)
 * - Consumer for processing QR configuration events
 * - Separation of concerns: Quick aggregation API responses + background QR processing
 */
@Global()
@Module({
  imports: [
    // Import configuration for RabbitMQ settings
    ConfigModule.forFeature(rabbitmqConfig),

    MongooseModule.forFeature([
      { name: QrCode.name, schema: QrCodeSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Vertical.name, schema: VerticalSchema },
      { name: ProductType.name, schema: ProductTypeSchema },
      { name: Property.name, schema: PropertySchema },
      { name: PropertyValue.name, schema: PropertyValueSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Session.name, schema: SessionSchema },
      { name: SessionMessage.name, schema: SessionMessageSchema },
    ]),
    ConfigurationModule,
  ],
  providers: [
    // Core RabbitMQ connection management
    RabbitMQConnectionService,

    // Publisher for package updates
    PackageUpdatePublisher,

    // publisher for QR configuration events
    QrConfigurationPublisher,

    // Consumer for processing package updates
    PackageUpdateConsumer,

    // Consumer for processing QR configuration events
    QrConfigurationConsumer,
  ],
  exports: [
    // Export connection service if needed by other modules
    RabbitMQConnectionService,

    // Export QR configuration publisher for use in QR configuration processing
    QrConfigurationPublisher,

    // Export QR configuration consumer for use in QR configuration processing
    QrConfigurationConsumer,

    // Export package update publisher for use in PackageAggregationService
    PackageUpdatePublisher,

    // Export package update consumer for manual testing/debugging
    PackageUpdateConsumer,
  ],
})
export class RabbitMQModule {}
