import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  walletAddress: string;
  mintedTokens: string[]; // Array of token symbols
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema: Schema = new Schema({
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    unique: true,
    trim: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please fill a valid wallet address'], // Basic validation for wallet address
  },
  mintedTokens: {
    type: [String], // Array of strings (token symbols)
    default: [],
  },
}, { timestamps: true }); // timestamps will add createdAt and updatedAt

// Ensure the model is not recompiled if it already exists
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User; 