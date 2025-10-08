import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UnitMeasurementDocument = UnitMeasurement & Document;

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
export class UnitMeasurement {
  id?: string;

  @Prop({ type: String })
  nameAr: string;

  @Prop({ type: String })
  nameEn: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;
}

const UnitMeasurementSchema = SchemaFactory.createForClass(UnitMeasurement);

export { UnitMeasurementSchema };
