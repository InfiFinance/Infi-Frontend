import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  walletAddress: string;
}

const UserSchema: Schema = new Schema({
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    unique: true,
    trim: true,
  },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export async function POST(request: Request) {
  try {
    await dbConnect();

    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const existingUser = await User.findOne({ walletAddress });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists', user: existingUser }, { status: 200 });
    }

    const newUser = new User({ walletAddress });
    await newUser.save();

    console.log('Saved wallet address:', walletAddress);

    return NextResponse.json({ message: 'User added successfully', user: newUser }, { status: 201 });

  } catch (error) {
    console.error('Error adding user:', error);
    if (error instanceof Error && 'code' in error && (error as any).code === 11000) {
        return NextResponse.json({ error: 'Wallet address already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 