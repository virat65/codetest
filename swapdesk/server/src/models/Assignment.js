
import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },

    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true
    }
  },
  { timestamps: true }
);

// A staff member can only be assigned once to a particular shift.
assignmentSchema.index(
  { staff: 1, shift: 1 },
  { unique: true }
);

assignmentSchema.index({ shift: 1 });
assignmentSchema.index({ staff: 1, createdAt: -1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
