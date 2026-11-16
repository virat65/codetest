
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Staff from '../models/Staff.js';

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../utils/tokenUtils.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth'
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

export const login = async (req, res) => {
  try {    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const staff = await Staff.findOne({
      email: email.toLowerCase().trim()
    }).select('+password +refreshTokenHash');

    if (!staff || !staff.active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      staff.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const accessToken = generateAccessToken(staff);
    const refreshToken = generateRefreshToken(staff);

    staff.refreshTokenHash = hashToken(refreshToken);
    await staff.save();

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      user: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        clinicalRole: staff.clinicalRole,
        department: staff.department
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to login'
    });
  }
};

export const refresh = async (req, res) => {
  try {
    const oldToken = req.cookies.refreshToken;

    if (!oldToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token missing'
      });
    }

    const decoded = verifyRefreshToken(oldToken);

    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const staff = await Staff.findById(decoded.id).select(
      '+refreshTokenHash'
    );

    if (
      !staff ||
      !staff.active ||
      !staff.refreshTokenHash ||
      staff.refreshTokenHash !== hashToken(oldToken)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Refresh session is invalid'
      });
    }

    const newAccessToken = generateAccessToken(staff);
    const newRefreshToken = generateRefreshToken(staff);

    staff.refreshTokenHash = hashToken(newRefreshToken);
    await staff.save();

    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    res.clearCookie('refreshToken', cookieOptions);

    return res.status(401).json({
      success: false,
      message: 'Refresh session expired or invalid'
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const decoded = verifyRefreshToken(token);

        await Staff.findByIdAndUpdate(decoded.id, {
          $set: { refreshTokenHash: null }
        });
      } catch {
        // Invalid or expired token: clear the cookie anyway.
      }
    }

    res.clearCookie('refreshToken', cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to logout'
    });
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};
