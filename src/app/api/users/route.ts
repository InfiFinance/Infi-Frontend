import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import User from '@/lib/models/User';

export async function POST(request: Request) {
  try {
    await dbConnect();

    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    let existingUser = await User.findOne({ walletAddress });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists', user: existingUser }, { status: 200 });
    }

    const newUser = new User({ walletAddress });
    await newUser.save();

    console.log('Saved wallet address:', walletAddress);

    return NextResponse.json({ message: 'User added successfully', user: newUser }, { status: 201 });

  } catch (error: any) {
    console.error('Error adding user:', error);
    if (error.code === 11000) {
        return NextResponse.json({ error: 'Wallet address already exists' }, { status: 409 });
    }
    if (error.name === 'ValidationError') {
        return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 