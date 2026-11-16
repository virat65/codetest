import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null
    },
    actorType: {
      type: String,
      enum: ['staff', 'system'],
      default: 'staff',
      required: true
    },
    fromStatus: {
      type: String,
      required: true
    },
    toStatus: {
      type: String,
      required: true
    },
    note: {
      type: String,
      trim: true,
      default: ''
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const swapRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true
    },
    colleague: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    status: {
      type: String,
      enum: [
        'pending_colleague',
        'pending_admin',
        'approved',
        'declined',
        'rejected',
        'cancelled',
        'expired'
      ],
      default: 'pending_colleague',
      required: true
    },
    audit: {
      type: [auditSchema],
      default: []
    }
  },
  { timestamps: true }
);

swapRequestSchema.index({ requester: 1, status: 1, createdAt: -1 });
swapRequestSchema.index({ colleague: 1, status: 1, createdAt: -1 });
swapRequestSchema.index({ status: 1, createdAt: -1 });
swapRequestSchema.index({ shift: 1, status: 1 });

const SwapRequest = mongoose.model('SwapRequest', swapRequestSchema);

export default SwapRequest;
