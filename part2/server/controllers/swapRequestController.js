// server/controllers/swapRequestController.js
const SwapRequest = require('../models/SwapRequest');
const Shift = require('../models/Shift');
const Assignment = require('../models/Assignment');
const Staff = require('../models/Staff');

const hoursBetween = (start, end) => (end - start) / 36e5;

exports.listRequests = async (req, res) => {
  const { cursor, limit = 20, ...filters } = req.query;
  const query = { ...filters };
  if (cursor) query._id = { $gt: cursor };

  const items = await SwapRequest.find(query)
    .limit(Number(limit))
    .populate('requester colleague shift');

  res.json({
    items,
    nextCursor: items.length ? items[items.length - 1]._id : null,
  });
};

exports.approveRequest = async (req, res) => {
  try {
    const request = await SwapRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.status === 'approved') {
      return res.status(409).json({ message: 'Request already approved' });
    }

    const shift = await Shift.findById(request.shift);
    const colleague = await Staff.findById(request.colleague);

    if (colleague.clinicalRole !== shift.requiredRole) {
      return res.status(422).json({ message: 'Colleague role does not match this shift' });
    }
    if (colleague.licenceExpiry < new Date()) {
      return res.status(422).json({ message: 'Colleague licence has expired' });
    }

    const dayStart = new Date(shift.start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sameDay = await Assignment.find({ staff: request.colleague }).populate({
      path: 'shift',
      match: { start: { $gte: dayStart, $lt: dayEnd } },
    });
    const clash = sameDay.some(
      (a) => a.shift && a.shift.start < shift.end && a.shift.end > shift.start
    );
    if (clash) {
      return res.status(422).json({ message: 'Colleague has an overlapping shift' });
    }

    const weekStart = new Date(shift.start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekAssignments = await Assignment.find({ staff: request.requester }).populate({
      path: 'shift',
      match: { start: { $gte: weekStart, $lt: weekEnd } },
    });
    const weekHours = weekAssignments
      .filter((a) => a.shift)
      .reduce((sum, a) => sum + hoursBetween(a.shift.start, a.shift.end), 0);
    if (weekHours + hoursBetween(shift.start, shift.end) > 48) {
      return res.status(422).json({ message: 'Weekly hour limit exceeded' });
    }

    await Assignment.deleteOne({ shift: shift._id });
    await Assignment.create({ shift: shift._id, staff: request.colleague });

    request.status = 'approved';
    request.audit.push({
      by: req.user.id,
      at: new Date(),
      from: request.status,
      to: 'approved',
      note: req.body.note,
    });
    await request.save();

    res.json(request);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message, stack: err.stack });
  }
};

exports.cancelRequest = async (req, res) => {
  const request = await SwapRequest.findById(req.params.id);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  if (request.requester !== req.user.id) {
    return res.status(403).json({ message: 'You can only cancel your own request' });
  }
  request.status = 'cancelled';
  request.audit.push({ by: req.user.id, at: new Date(), from: request.status, to: 'cancelled' });
  await request.save();
  res.json(request);
};
