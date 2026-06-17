import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "supabase/migrations");
const files = fs.readdirSync(dir);

for (const file of files) {
  const legacyMatch = file.match(/^(\d{8})_(\d{6})_(.+)\.sql$/);
  if (legacyMatch) {
    const newName = `${legacyMatch[1]}${legacyMatch[2]}_${legacyMatch[3]}.sql`;
    fs.renameSync(path.join(dir, file), path.join(dir, newName));
    console.log(`Renamed: ${file} -> ${newName}`);
  }
}
