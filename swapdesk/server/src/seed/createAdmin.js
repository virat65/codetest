
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Staff from '../models/Staff.js';

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = 'admin@swapdesk.com';

    const existingAdmin = await Staff.findOne({ email });

    if (existingAdmin) {
      console.log('Admin account already exists:', email);
      return;
    }

    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    await Staff.create({
      name: 'SwapDesk Admin',
      email,
      password: hashedPassword,
      role: 'admin',
      active: true
    });

    console.log('Admin created successfully!');
    console.log('Email:', email);
    console.log('Password: Admin@123');

  } catch (error) {
    console.error('Admin seed error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
