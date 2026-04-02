import { createClient } from "@supabase/supabase-js";
import 'dotenv/config'; // to load .env if necessary

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE env vars.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Checking buckets...");
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error("Error listing buckets:", error);
        return;
    }
    
    console.log("Buckets:", buckets.map(b => b.name));

    const bucketName = "logos";
    if (!buckets.some(b => b.name === bucketName)) {
        console.log(`Creating bucket '${bucketName}'...`);
        const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
        });
        if (createError) {
            console.error("Error creating bucket:", createError);
        } else {
            console.log("Bucket created successfully:", data);
        }
    } else {
        console.log(`Bucket '${bucketName}' already exists. Making sure it's public...`);
        const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
        });
        if (updateError) {
            console.error("Error updating bucket:", updateError);
        } else {
            console.log("Bucket is public.");
        }
    }
}

main();
