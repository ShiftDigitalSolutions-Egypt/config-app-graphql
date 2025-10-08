import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from './_user.model';

export type MasterDocument = MasterData & Document;

export interface ReferFactor {
  userType: UserRole;
  factor: number;
  reward: number;
}

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
export class MasterData {
  id?: string;

  @Prop({ type: Number })
  criticalUpgradeAndroid: number;

  @Prop({ type: Number })
  criticalUpgradeIos: number;

  @Prop({ type: Number })
  nominalUpgradeAndroid: number;

  @Prop({ type: Number })
  nominalUpgradeIos: number;

  @Prop({ type: Boolean })
  updateDataBase: boolean;

  @Prop({ required: true, type: Number })
  applicationStatus: number;

  @Prop({ type: String, required: false })
  appName: string;
  @Prop({ type: Number })
  criticalUpgradeHuawei: number;
}

const MasterDataSchema = SchemaFactory.createForClass(MasterData);

export { MasterDataSchema };
