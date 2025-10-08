// export class TrackType { }
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type TrackTypeDocument = TrackType & Document;

export enum UserTrack {
  ADMIN = 'ADMIN',
  ElECTRICANS = 'ElECTRICANS',
  POD = 'POD',
  SHOPSELLER = 'SHOPSELLER',
  PORMOTER = 'PORMOTER',
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
export class TrackType {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({ required: true, type: String, enum: Object.values(UserTrack) })
  role: UserTrack;

  @Prop({ type: String, required: true })
  unit: string;
}

const TrackTypeSchema = SchemaFactory.createForClass(TrackType);

export { TrackTypeSchema };
