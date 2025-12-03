import { registerAs } from '@nestjs/config';

export interface RabbitMQConfig {
  url: string;
  heartbeat: number;
  prefetchCount: number;
  socketOptions: {
    heartbeatIntervalInSeconds: number;
    reconnectTimeInSeconds: number;
  };
}

export default registerAs('rabbitmq', (): RabbitMQConfig => ({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT, 10) || 60,
  prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH_COUNT, 10) || 10,
  socketOptions: {
    heartbeatIntervalInSeconds: parseInt(process.env.RABBITMQ_HEARTBEAT_INTERVAL, 10) || 15,
    reconnectTimeInSeconds: parseInt(process.env.RABBITMQ_RECONNECT_TIME, 10) || 10,
  },
}));