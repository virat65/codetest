
import bcrypt from 'bcryptjs';
import Staff from '../models/Staff.js';

// POST /api/staff - Admin creates a staff member
export const createStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      clinicalRole,
      department,
      licenceExpiry
    } = req.body ?? {};

    if (!name || !email || !password || !clinicalRole || !department) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, clinical role and department are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 8 characters'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingStaff = await Staff.findOne({ email: normalizedEmail });

    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const staff = await Staff.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'staff',
      clinicalRole,
      department,
      licenceExpiry: licenceExpiry || null,
      active: true
    });

    return res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        clinicalRole: staff.clinicalRole,
        department: staff.department,
        licenceExpiry: staff.licenceExpiry,
        active: staff.active
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create staff error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while creating staff'
    });
  }
};

// GET /api/staff - Admin gets paginated staff list
export const getStaff = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { role: 'staff' };

    if (req.query.department) {
      filter.department = req.query.department;
    }

    if (req.query.clinicalRole) {
      filter.clinicalRole = req.query.clinicalRole;
    }

    if (req.query.active !== undefined) {
      if (!['true', 'false'].includes(req.query.active)) {
        return res.status(400).json({
          success: false,
          message: 'Active filter must be true or false'
        });
      }

      filter.active = req.query.active === 'true';
    }

    const [staff, total] = await Promise.all([
      Staff.find(filter)
        .select('-password -refreshTokenHash')
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Staff.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      staff
    });
  } catch (error) {
    console.error('Get staff error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while fetching staff'
    });
  }
};
