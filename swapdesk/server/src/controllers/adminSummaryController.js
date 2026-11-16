import Assignment from '../models/Assignment.js';

export const getWeeklyDepartmentSummary = async (req, res) => {
  try {
    const now = new Date();
    const day = now.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;

    const weekStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday
    ));

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const summary = await Assignment.aggregate([
      {
        $lookup: {
          from: 'shifts',
          localField: 'shift',
          foreignField: '_id',
          as: 'shiftData'
        }
      },
      { $unwind: '$shiftData' },
      {
        $match: {
          'shiftData.start': {
            $gte: weekStart,
            $lt: weekEnd
          }
        }
      },
      {
        $group: {
          _id: '$shiftData.department',
          assignmentCount: { $sum: 1 },
          totalHours: {
            $sum: {
              $divide: [
                {
                  $subtract: [
                    '$shiftData.end',
                    '$shiftData.start'
                  ]
                },
                3600000
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          assignmentCount: 1,
          totalHours: { $round: ['$totalHours', 2] }
        }
      },
      { $sort: { department: 1 } }
    ]).option({ maxTimeMS: 300 });

    return res.status(200).json({
      success: true,
      weekStart,
      weekEnd,
      summary
    });
  } catch (error) {
    console.error('Weekly department summary error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch weekly department summary'
    });
  }
};
