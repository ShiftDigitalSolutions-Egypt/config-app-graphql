// Models Barrel Exports
// This file provides a centralized export point for all entity models
// Note: Some exports may have naming conflicts - import specific entities when needed

// Base Models
export { BaseModel } from './base.model';

// Core Entities - Essential ones first
export * from './product.entity';
export * from './qr-code.entity'; 
export * from './user-type.entity';
export * from './supplier.entity';
export * from './vertical.entity';

// Note: Additional entities can be imported directly from their respective files
// to avoid naming conflicts. Use specific imports when needed:
// import { SpecificEntity } from 'src/models/specific-entity.entity';