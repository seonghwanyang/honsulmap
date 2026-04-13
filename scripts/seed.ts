import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SEED_SPOTS as seedSpots } from '../src/data/seed';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log(`Inserting ${seedSpots.length} spots...`);

  // Insert in batches of 20
  for (let i = 0; i < seedSpots.length; i += 20) {
    const batch = seedSpots.slice(i, i + 20);
    const { error } = await supabase.from('spots').upsert(
      batch.map((s) => ({ ...s })),
      { onConflict: 'slug' }
    );
    if (error) {
      console.error(`Batch ${i / 20 + 1} error:`, error.message);
    } else {
      console.log(`Batch ${i / 20 + 1}: ${batch.length} spots inserted`);
    }
  }

  // Verify
  const { count } = await supabase.from('spots').select('*', { count: 'exact', head: true });
  console.log(`Done! Total spots in DB: ${count}`);
}

seed().catch(console.error);
