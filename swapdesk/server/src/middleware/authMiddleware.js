
import { verifyAccessToken } from '../utils/tokenUtils.js';
import Staff from '../models/Staff.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const staff = await Staff.findById(decoded.id).select(
      '-password -refreshTokenHash'
    );

    if (!staff || !staff.active) {
      return res.status(401).json({
        success: false,
        message: 'Account is unavailable'
      });
    }

    req.user = staff;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token'
    });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};
