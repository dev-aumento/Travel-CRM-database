import mongoose from 'mongoose';

const crmDatabaseSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'crm_database', unique: true },
        data: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
);

export const CrmDatabase = mongoose.model('CrmDatabase', crmDatabaseSchema);
