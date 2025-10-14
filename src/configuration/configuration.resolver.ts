import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { CreateQrConfigrationDto } from './dto/create-qr-configration.dto';
import { QrCode } from '../models/qr-code.entity';

@Resolver(() => QrCode)
export class ConfigurationResolver {
  private readonly logger = new Logger(ConfigurationResolver.name);

  constructor(private readonly configurationService: ConfigurationService) {}

  /**
   * Configure an OUTER QR code
   * Handles validation, configuration, and relationship management atomically
   */
  @Mutation(() => QrCode, {
    description: 'Configure an OUTER QR code with product data and relationships',
  })
  async configureOuterQr(
    @Args('input', { type: () => CreateQrConfigrationDto }) 
    input: CreateQrConfigrationDto,
  ): Promise<QrCode> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Configuring OUTER QR with input: ${JSON.stringify(input)}`);
      
      const configuredQr = await this.configurationService.configureOuterQr(input);
      
      const executionTime = Date.now() - startTime;
      this.logger.log(`Successfully configured OUTER QR: ${configuredQr.value} (took ${executionTime}ms)`);
      return configuredQr;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Failed to configure OUTER QR after ${executionTime}ms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a configured QR code by value or ID
   */
  @Query(() => QrCode, {
    description: 'Get a configured QR code with populated relationships',
  })
  async getConfiguredQr(
    @Args('qrValueOrId', { type: () => String }) 
    qrValueOrId: string,
  ): Promise<QrCode> {
    try {
      return await this.configurationService.getConfiguredQr(qrValueOrId);
    } catch (error) {
      this.logger.error(`Failed to get QR code ${qrValueOrId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}