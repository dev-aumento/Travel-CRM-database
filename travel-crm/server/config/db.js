import dns from 'dns';
import mongoose from 'mongoose';

// Some Windows/residential DNS servers fail SRV lookups required by mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MONGODB_URI =
    process.env.MONGODB_URI ||
    'mongodb+srv://travelCRM:dbTravelCRM@cluster0.pcwfy2e.mongodb.net/Travel-crm?retryWrites=true&w=majority&appName=Cluster0';

export const connectDB = async () => {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

export default connectDB;
