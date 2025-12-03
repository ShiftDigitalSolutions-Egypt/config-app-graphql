import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { EXCHANGE_NAMES, QUEUE_NAMES, ROUTING_KEYS } from '../interfaces/qr-configuration.interface';
import { 
  PACKAGE_UPDATE_EXCHANGE_NAMES,
  PACKAGE_UPDATE_QUEUE_NAMES,
  PACKAGE_UPDATE_ROUTING_KEYS
} from '../interfaces/package-update.interface';
import { RabbitMQConfig } from '../config/rabbitmq.config';

@Injectable()
export class RabbitMQConnectionService implements OnModuleInit, OnApplicationShutdown {
  
  private readonly logger = new Logger(RabbitMQConnectionService.name);
  private connection: AmqpConnectionManager;
  private publisherChannel: ChannelWrapper;
  private consumerChannel: ChannelWrapper;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    return this.initialize();
  }

  async initialize(): Promise<void> {
    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
      
      this.logger.log(`Connecting to RabbitMQ at ${rabbitmqUrl}`);
      
      // Create connection with reconnection options
      this.connection = amqp.connect([rabbitmqUrl], {
        reconnectTimeInSeconds: 5,
        heartbeatIntervalInSeconds: 30,
      });

      this.connection.on('connect', () => {
        this.logger.log('Successfully connected to RabbitMQ');
      });

      this.connection.on('disconnect', (err) => {
        this.logger.warn(`Disconnected from RabbitMQ: ${err}`);
      });

      this.connection.on('connectFailed', (err) => {
        this.logger.error(`Failed to connect to RabbitMQ: ${err}`);
      });

      // Create publisher channel for sending messages
      this.publisherChannel = this.connection.createChannel({
        json: true,
        setup: (channel: ConfirmChannel) => this.setupPublisherChannel(channel),
      });

      // Create consumer channel for receiving messages
      this.consumerChannel = this.connection.createChannel({
        json: true,
        setup: (channel: ConfirmChannel) => this.setupConsumerChannel(channel),
      });

      this.logger.log('RabbitMQ channels created successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize RabbitMQ connection: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async setupPublisherChannel(channel: ConfirmChannel): Promise<void> {
    // Declare exchange for QR configuration events
    await channel.assertExchange('qr-configuration-exchange', 'direct', {
      durable: true,
    });

    // Declare exchange for package update events
    await channel.assertExchange(PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE, 'topic', {
      durable: true,
      autoDelete: false,
    });

    this.logger.log('Publisher channel setup completed');
  }

  private async setupConsumerChannel(channel: ConfirmChannel): Promise<void> {
    // Declare exchange for QR configuration
    await channel.assertExchange('qr-configuration-exchange', 'direct', {
      durable: true,
    });

    // Declare exchange for package updates
    await channel.assertExchange(PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE, 'topic', {
      durable: true,
      autoDelete: false,
    });

    // Declare QR configuration queues
    await channel.assertQueue('qr-configuration-queue', {
      durable: true,
      arguments: {
        'x-max-retries': 3,
        'x-message-ttl': 300000, // 5 minutes
      },
    });

    await channel.assertQueue('qr-configuration-results-queue', {
      durable: true,
    });

    // Declare package update queues
    await channel.assertQueue(PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE, {
      durable: true,
      exclusive: false,
      autoDelete: false,
      arguments: {
        'x-message-ttl': 1800000, // 30 minutes TTL for package updates
        'x-max-retries': 3,
        // Optional: Add dead letter exchange for failed messages
        // 'x-dead-letter-exchange': 'dlx.package.update',
      },
    });

    await channel.assertQueue(PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE_RESULTS, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });

    // Bind QR configuration queues to exchange
    await channel.bindQueue('qr-configuration-queue', 'qr-configuration-exchange', 'qr.configure');
    await channel.bindQueue('qr-configuration-results-queue', 'qr-configuration-exchange', 'qr.configure.result');

    // Bind package update queues to exchange
    await channel.bindQueue(
      PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE,
      PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
      PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_REQUEST
    );

    await channel.bindQueue(
      PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE_RESULTS,
      PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
      PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_RESULT
    );

    // Bind package cycle routing keys to the same queue (different processing logic based on routing key)
    await channel.bindQueue(
      PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE,
      PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
      PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_REQUEST
    );

    await channel.bindQueue(
      PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE_RESULTS,
      PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
      PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_RESULT
    );

    this.logger.log('Consumer channel setup completed');
  }

  getPublisherChannel(): ChannelWrapper {
    if (!this.publisherChannel) {
      throw new Error('Publisher channel not initialized. Call initialize() first.');
    }
    return this.publisherChannel;
  }

  getConsumerChannel(): ChannelWrapper {
    if (!this.consumerChannel) {
      throw new Error('Consumer channel not initialized. Call initialize() first.');
    }
    return this.consumerChannel;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down RabbitMQ connection (signal: ${signal})`);
    
    try {
      if (this.publisherChannel) {
        await this.publisherChannel.close();
        this.logger.log('Publisher channel closed');
      }

      if (this.consumerChannel) {
        await this.consumerChannel.close();
        this.logger.log('Consumer channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        this.logger.log('RabbitMQ connection closed');
      }
    } catch (error) {
      this.logger.error(`Error during RabbitMQ shutdown: ${error.message}`, error.stack);
    }
  }

  
}