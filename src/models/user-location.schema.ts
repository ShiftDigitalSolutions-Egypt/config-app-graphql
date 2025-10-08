import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class UserLocation {
  @Prop({
    type: String,
    enum: ['Point'], // Ensure the value is always 'Point'
    default: 'Point',
  })
  type: string = 'Point'; // Always set to 'Point'

  @Prop({
    type: [Number], // GeoJSON coordinates: [longitude, latitude]
    required: false, // Mark as optional in Mongoose
    validate: {
      validator: function (value: number[] | undefined) {
        // Skip validation if `coordinates` is not provided
        if (!value || value.length === 0) {
          return true;
        }
        return (
          Array.isArray(value) &&
          value.length === 2 &&
          value[0] >= -180 &&
          value[0] <= 180 && // Longitude validation
          value[1] >= -90 &&
          value[1] <= 90 // Latitude validation
        );
      },
      message:
        'Coordinates must be an array of [longitude, latitude] with valid ranges.',
    },
  })
  coordinates?: number[]; // Optional field
}

export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);
