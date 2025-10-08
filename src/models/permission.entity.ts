import { Prop, Schema, SchemaFactory, DiscriminatorOptions, raw } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
//   import { Document, Model, ObjectId, Mongoose } from 'mongoose';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { UserRoles, UserType } from './user-type.entity';
import { UserRole } from './_user.model';
import { Constants } from '../utils/constants';
import BasePermission from '../dto/basePermission';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type PermissionDocument = Permission & Document;

@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      delete doc.__v;
      delete doc._id;
      return {
        ...doc,
      };
    },
  },
})
export class Permission {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: true,
  })
  userType: string | UserType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;

  @Prop({ required: false, type: [String], enum: BasePermission /*Object.values(BasePermission)*/ })
  permissionGroup: [BasePermission];

  @Prop({ default: false, type: Boolean }) // tofo using  in joining request
  isDefault?: boolean;

  @Prop({ type: String, default: '' })
  updatedBy?: string;

  @Prop({ type: String, enum: Object.values(UserRoles), required: true })
  category: UserRoles;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  createdBy: string; 
}

const PermissionSchema = SchemaFactory.createForClass(Permission);

export { PermissionSchema };
