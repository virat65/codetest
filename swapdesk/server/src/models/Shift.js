
import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      enum: [
        'ICU',
        'ER',
        'General Ward',
        'Paediatrics',
        'Radiology'
      ],
      required: true
    },

    requiredClinicalRole: {
      type: String,
      enum: ['Doctor', 'Nurse', 'Technician'],
      required: true
    },

    start: {
      type: Date,
      required: true
    },

    end: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.start || value > this.start;
        },
        message: 'Shift end must be after shift start'
      }
    },

    slots: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { timestamps: true }
);

shiftSchema.index({ start: 1, _id: 1 });
shiftSchema.index({ department: 1, start: 1 });

const Shift = mongoose.model('Shift', shiftSchema);

export default Shift;
