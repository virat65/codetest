import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff',
      required: true
    },
    clinicalRole: {
      type: String,
      enum: ['Doctor', 'Nurse', 'Technician'],
      required: function () {
        return this.role === 'staff';
      }
    },
    department: {
      type: String,
      enum: ['ICU', 'ER', 'General Ward', 'Paediatrics', 'Radiology'],
      required: function () {
        return this.role === 'staff';
      }
    },
    licenceExpiry: { type: Date, default: null },
    active: { type: Boolean, default: true },
    refreshTokenHash: { type: String, default: null, select: false },

    // Updated inside approval transactions to serialize roster changes.
    rosterVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

staffSchema.index({ role: 1, active: 1 });
staffSchema.index({ department: 1, clinicalRole: 1, active: 1 });

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
