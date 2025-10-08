import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get configuration service
  const configService = app.get(ConfigService);
  
  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  
  // Enable CORS for GraphQL subscriptions
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Get port from environment
  const port = configService.get<number>('PORT') || 4000;
  
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📊 GraphQL Playground: http://localhost:${port}/graphql`);
  
  // Hot Module Replacement
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();