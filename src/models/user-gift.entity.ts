import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Model, Schema as MongooseSchema } from 'mongoose';
import { RequestType } from './_client-request.entity';
import { Gift, GiftType, OptionType } from './gift.entity';
import { Track, TrackDocument } from './milestone.entity';
import { Wheel, WheelDocument } from './wheel.entity';

export type UserGiftDocument = UserGift & Document;

export interface ExtendedGift {
  id: string;
  name: string;
  photo: string;
  value: number;
}

@Schema()
export class UserGift {
  method?: RequestType;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Track.name,
    default: null,
    // required: true,
  })
  milestone?: string | TrackDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Wheel.name,
    default: null,
    // required: true,
  })
  wheel?: string | WheelDocument;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: Gift.name,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },

      photo: {
        type: String,
        required: true,
      },
      vendor: {
        type: String,
        required: false,
      },
      value: {
        type: Number,
        required: true,
      },

      giftType: {
        type: String,
        enum: Object.values(GiftType),
        required: true
      },
      optionControl: {
        type: [String],
        enum: Object.values(OptionType),
        default: []
      },
    }),
  )
  gift?: ExtendedGift;
}

const UserGiftSchema = SchemaFactory.createForClass(UserGift);

export { UserGiftSchema };
